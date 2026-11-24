package journal

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func workspace(t *testing.T) (*Workspace, string) {
	t.Helper()
	path := filepath.Join(t.TempDir(), "installation")
	w, err := Open(path, true)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(w.Close)
	return w, path
}
func TestLockRejectsConcurrentWriterAndReleasesOnClose(t *testing.T) {
	w, path := workspace(t)
	if _, err := Open(path, false); !errors.Is(err, ErrLocked) {
		t.Fatal("concurrent writer accepted", err)
	}
	w.Close()
	next, err := Open(path, false)
	if err != nil {
		t.Fatal(err)
	}
	next.Close()
}
func TestFreshInstallCannotReuseDirectory(t *testing.T) {
	_, path := workspace(t)
	if _, err := Open(path, true); err == nil {
		t.Fatal("existing directory reused")
	}
}
func TestAtomicFailurePreservesPreviousCompleteJournal(t *testing.T) {
	w, _ := workspace(t)
	if err := w.Atomic("journal.json", []byte("old")); err != nil {
		t.Fatal(err)
	}
	err := w.atomic("journal.json", []byte("new"), func() error { return errors.New("injected interruption before rename") })
	if err == nil {
		t.Fatal("fault was ignored")
	}
	value, err := w.Read("journal.json", 100)
	if err != nil || string(value) != "old" {
		t.Fatal("partial journal replaced previous state")
	}
	if err := w.Atomic("journal.json", []byte("new")); err != nil {
		t.Fatal(err)
	}
	value, _ = w.Read("journal.json", 100)
	if string(value) != "new" {
		t.Fatal("retry failed")
	}
}
func TestWorkspaceRejectsSymlinksWorldAccessAndMissingLock(t *testing.T) {
	for _, kind := range []string{"symlink", "worldAccess", "missingLock"} {
		t.Run(kind, func(t *testing.T) {
			w, path := workspace(t)
			w.Close()
			switch kind {
			case "symlink":
				link := path + "-link"
				if err := os.Symlink(path, link); err != nil {
					t.Fatal(err)
				}
				path = link
			case "worldAccess":
				if err := os.Chmod(path, 0755); err != nil {
					t.Fatal(err)
				}
			case "missingLock":
				if err := os.Remove(filepath.Join(path, "install.lock")); err != nil {
					t.Fatal(err)
				}
			}
			if opened, err := Open(path, false); err == nil {
				opened.Close()
				t.Fatal("unsafe workspace accepted")
			}
		})
	}
}
func TestJournalRefusesSymlinkHardlinkPublicAndOversizedFiles(t *testing.T) {
	for _, kind := range []string{"symlink", "hardlink", "public", "oversize"} {
		t.Run(kind, func(t *testing.T) {
			w, path := workspace(t)
			p := filepath.Join(path, "journal.json")
			if err := os.WriteFile(p, []byte("data"), 0600); err != nil {
				t.Fatal(err)
			}
			switch kind {
			case "symlink":
				os.Remove(p)
				if err := os.Symlink(filepath.Join(t.TempDir(), "outside"), p); err != nil {
					t.Fatal(err)
				}
			case "hardlink":
				if err := os.Link(p, p+"-link"); err != nil {
					t.Fatal(err)
				}
			case "public":
				os.Chmod(p, 0644)
			}
			limit := int64(100)
			if kind == "oversize" {
				limit = 2
			}
			if _, err := w.Read("journal.json", limit); err == nil {
				t.Fatal("unsafe private file read")
			}
			if kind != "oversize" {
				if err := w.Atomic("journal.json", []byte("replace")); err == nil {
					t.Fatal("unsafe journal overwritten")
				}
			}
		})
	}
	w, _ := workspace(t)
	for _, name := range []string{"../outside", "/absolute", "systemd/escape"} {
		if err := w.Atomic(name, []byte("x")); err == nil {
			t.Fatal("path escape accepted")
		}
	}
}
func TestClientConfigMustBePrivateEmptyAndNonSymbolic(t *testing.T) {
	w, path := workspace(t)
	if err := w.EmptyDirectory("docker-client", true); err != nil {
		t.Fatal(err)
	}
	if err := w.EmptyDirectory("docker-client", false); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(path, "docker-client/config.json"), []byte("untrusted helper config"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := w.EmptyDirectory("docker-client", false); err == nil {
		t.Fatal("ambient credentials/configuration accepted")
	}
}
func TestUnitFilesRemainConfinedAndCheckActualBytes(t *testing.T) {
	w, path := workspace(t)
	files := map[string][]byte{"cloudlane-test.service": []byte("[Service]\nExecStart=/usr/bin/true\n")}
	if ok, _ := w.UnitsMatch(files); ok {
		t.Fatal("missing units healthy")
	}
	if err := w.Units(files); err != nil {
		t.Fatal(err)
	}
	if ok, err := w.UnitsMatch(files); err != nil || !ok {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(path, "systemd/cloudlane-test.service"), []byte("drift"), 0600); err != nil {
		t.Fatal(err)
	}
	if ok, _ := w.UnitsMatch(files); ok {
		t.Fatal("unit drift missed")
	}
}
