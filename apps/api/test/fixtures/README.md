# Isolated-review TLS fixture

The PostgreSQL test runner generates a fresh synthetic key and two-day self-signed certificate under ignored `test-results/auth-fixture/`. They cover loopback/localhost and `panel.example.test` SANs. Clients trust that certificate explicitly for their own requests, retaining TLS chain/hostname verification. No global TLS-disable switch or real deployment credential is used. Key/certificate bytes are not committed, packaged or uploaded as CI evidence.

The fixture exercises encrypted sockets and Host/Origin/cookie behavior against a disposable database. It proves no public CA issuance, Caddy integration, certificate renewal or production TLS acceptance.
