package platform

import "fmt"

func Name(s State, component string) string { return "cl-" + s.Instance + "-" + component }
func RenderUnits(s State) map[string][]byte {
	files := map[string][]byte{}
	for _, component := range []string{"db", "migrate", "api", "caddy"} {
		name := Name(s, component)
		after := "docker.service"
		requires := "docker.service"
		kind := "simple"
		remain := ""
		restart := "on-failure"
		switch component {
		case "migrate":
			after += " " + Name(s, "db") + ".service"
			requires += " " + Name(s, "db") + ".service"
			kind = "oneshot"
			remain = "RemainAfterExit=yes\n"
		case "api":
			after += " " + Name(s, "migrate") + ".service"
			requires += " " + Name(s, "migrate") + ".service"
		case "caddy":
			after += " " + Name(s, "api") + ".service"
			requires += " " + Name(s, "api") + ".service"
		}
		unit := fmt.Sprintf("[Unit]\nDescription=Cloudlane isolated review %s\nRequires=%s\nAfter=%s\nStartLimitIntervalSec=120\nStartLimitBurst=8\n\n[Service]\nType=%s\n%sExecStart=/usr/bin/docker --host=unix:///var/run/docker.sock --config=/etc/cloudlane/docker-client start --attach %s\nExecStop=/usr/bin/docker --host=unix:///var/run/docker.sock --config=/etc/cloudlane/docker-client stop --time=30 %s\nRestart=%s\nRestartSec=5\nTimeoutStartSec=90\nTimeoutStopSec=45\nUMask=0077\nNoNewPrivileges=yes\nPrivateTmp=yes\nProtectSystem=strict\nProtectHome=yes\n\n[Install]\nWantedBy=multi-user.target\n", component, requires, after, kind, remain, name, name, restart)
		files[name+".service"] = []byte(unit)
	}
	return files
}
