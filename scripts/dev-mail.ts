/**
 * Local SMTP catcher for development: accepts mail on SMTP_PORT (default 1025)
 * and writes each message to .mail/<timestamp>-<to>.html (and .txt). Nothing is delivered.
 * Use Mailpit instead if you prefer a web UI: docker run -p 8025:8025 -p 1025:1025 axllent/mailpit
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { simpleParser } from "mailparser";
import { SMTPServer } from "smtp-server";

const dir = path.resolve(".mail");
mkdirSync(dir, { recursive: true });
const port = Number(process.env.SMTP_PORT ?? 1025);

const server = new SMTPServer({
  authOptional: true,
  disabledCommands: ["STARTTLS"],
  onData(stream, _session, done) {
    simpleParser(stream)
      .then((mail) => {
        const to = (Array.isArray(mail.to) ? mail.to[0] : mail.to)?.text.replace(/[^a-z0-9@.]/gi, "_") ?? "unknown";
        const base = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${to}`);
        writeFileSync(`${base}.html`, `<!-- Subject: ${mail.subject} -->\n${mail.html || ""}`);
        writeFileSync(`${base}.txt`, `Subject: ${mail.subject}\nTo: ${to}\n\n${mail.text ?? ""}`);
        console.log(`captured "${mail.subject}" -> ${base}.html`);
        done();
      })
      .catch(done);
  },
});
server.listen(port, "127.0.0.1", () => console.log(`dev SMTP catcher on 127.0.0.1:${port}, writing to ${dir}`));
