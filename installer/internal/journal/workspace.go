package journal

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"regexp"
	"syscall"
)

var ErrUnsafe = errors.New("workspace_unsafe")
var ErrLocked = errors.New("installation_locked")
var names = regexp.MustCompile(`^[a-z][a-z0-9.-]{0,90}$`)

type Workspace struct {
	root *os.Root
	lock *os.File
	path string
}

func ID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", errors.New("entropy_unavailable")
	}
	return hex.EncodeToString(b), nil
}
func Open(path string, create bool) (*Workspace, error) {
	if create {
		if err := os.Mkdir(path, 0700); err != nil {
			return nil, errors.New("fresh_workspace_required")
		}
	}
	info, err := os.Lstat(path)
	if err != nil || !safe(info, true) {
		return nil, ErrUnsafe
	}
	r, err := os.OpenRoot(path)
	if err != nil {
		return nil, ErrUnsafe
	}
	w := &Workspace{root: r, path: path}
	fail := func(e error) (*Workspace, error) { w.Close(); return nil, e }
	dir, err := r.Open(".")
	if err != nil {
		return fail(ErrUnsafe)
	}
	actual, err := dir.Stat()
	dir.Close()
	if err != nil || !safe(actual, true) || !os.SameFile(info, actual) {
		return fail(ErrUnsafe)
	}
	flags := os.O_RDWR | syscall.O_NOFOLLOW | syscall.O_NONBLOCK
	if create {
		flags |= os.O_CREATE | os.O_EXCL
	}
	f, err := r.OpenFile("install.lock", flags, 0600)
	if err != nil {
		return fail(ErrUnsafe)
	}
	w.lock = f
	stat, err := f.Stat()
	if err != nil || !safe(stat, false) {
		return fail(ErrUnsafe)
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		return fail(ErrLocked)
	}
	return w, nil
}
func safe(info os.FileInfo, dir bool) bool {
	s, ok := info.Sys().(*syscall.Stat_t)
	if !ok || s.Uid != uint32(os.Geteuid()) || info.Mode()&os.ModeSymlink != 0 {
		return false
	}
	if dir {
		return info.IsDir() && info.Mode().Perm() == 0700
	}
	return info.Mode().IsRegular() && info.Mode().Perm() == 0600 && s.Nlink == 1
}
func (w *Workspace) Path() string { return w.path }
func (w *Workspace) Close() {
	if w.lock != nil {
		syscall.Flock(int(w.lock.Fd()), syscall.LOCK_UN)
		w.lock.Close()
		w.lock = nil
	}
	if w.root != nil {
		w.root.Close()
		w.root = nil
	}
}
func (w *Workspace) Read(name string, limit int64) ([]byte, error) {
	if !names.MatchString(name) {
		return nil, ErrUnsafe
	}
	f, err := w.root.OpenFile(name, os.O_RDONLY|syscall.O_NOFOLLOW|syscall.O_NONBLOCK, 0)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !safe(info, false) {
		return nil, ErrUnsafe
	}
	b, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, ErrUnsafe
	}
	return b, nil
}
func (w *Workspace) syncDir() error {
	f, err := w.root.Open(".")
	if err != nil {
		return err
	}
	defer f.Close()
	return f.Sync()
}
func (w *Workspace) Exclusive(name string, data []byte) error {
	if !names.MatchString(name) {
		return ErrUnsafe
	}
	f, err := w.root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return err
	}
	_, writeErr := f.Write(data)
	syncErr := f.Sync()
	closeErr := f.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return errors.New("private_write_failed")
	}
	return w.syncDir()
}

// Atomic preserves the previous complete journal until fsync+rename succeeds.
func (w *Workspace) Atomic(name string, data []byte) error { return w.atomic(name, data, nil) }
func (w *Workspace) atomic(name string, data []byte, beforeRename func() error) error {
	if !names.MatchString(name) || len(data) > 131072 {
		return ErrUnsafe
	}
	if _, err := w.Read(name, 131072); err != nil && !errors.Is(err, os.ErrNotExist) {
		return ErrUnsafe
	}
	id, err := ID()
	if err != nil {
		return err
	}
	temp := "pending-" + id + ".tmp"
	if err := w.Exclusive(temp, data); err != nil {
		return err
	}
	defer w.root.Remove(temp)
	if beforeRename != nil {
		if err := beforeRename(); err != nil {
			return err
		}
	}
	if err := w.root.Rename(temp, name); err != nil {
		return errors.New("journal_rename_failed")
	}
	if err := w.syncDir(); err != nil {
		return errors.New("journal_sync_failed")
	}
	return nil
}
func (w *Workspace) Units(files map[string][]byte) error {
	if err := w.root.Mkdir("systemd", 0700); err != nil && !errors.Is(err, os.ErrExist) {
		return ErrUnsafe
	}
	s, err := w.root.Lstat("systemd")
	if err != nil || !safe(s, true) {
		return ErrUnsafe
	}
	r, err := w.root.OpenRoot("systemd")
	if err != nil {
		return ErrUnsafe
	}
	defer r.Close()
	sub := &Workspace{root: r}
	for name, data := range files {
		if err := sub.Atomic(name, data); err != nil {
			return err
		}
	}
	return w.syncDir()
}
func (w *Workspace) UnitsMatch(files map[string][]byte) (bool, error) {
	s, err := w.root.Lstat("systemd")
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil || !safe(s, true) {
		return false, errors.New("unit_files_unsafe")
	}
	r, err := w.root.OpenRoot("systemd")
	if err != nil {
		return false, errors.New("unit_files_unsafe")
	}
	defer r.Close()
	sub := &Workspace{root: r}
	for name, want := range files {
		got, err := sub.Read(name, 16384)
		if errors.Is(err, os.ErrNotExist) {
			return false, nil
		}
		if err != nil {
			return false, errors.New("unit_files_unsafe")
		}
		if string(got) != string(want) {
			return false, nil
		}
	}
	return true, nil
}
func (w *Workspace) EmptyDirectory(name string, create bool) error {
	if !names.MatchString(name) {
		return ErrUnsafe
	}
	if create {
		if err := w.root.Mkdir(name, 0700); err != nil {
			return ErrUnsafe
		}
	}
	s, err := w.root.Lstat(name)
	if err != nil || !safe(s, true) {
		return ErrUnsafe
	}
	r, err := w.root.OpenRoot(name)
	if err != nil {
		return ErrUnsafe
	}
	defer r.Close()
	f, err := r.Open(".")
	if err != nil {
		return ErrUnsafe
	}
	defer f.Close()
	names, err := f.Readdirnames(1)
	if err != io.EOF || len(names) != 0 {
		return ErrUnsafe
	}
	return nil
}
