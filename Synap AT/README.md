# Synap AT

Standalone SynapDome marketing site with a working prospect intake form. It does not connect to assessment tools or start scans. The existing application elsewhere in this repository is unchanged.

## Local preview

Python 3.10 or newer:

```sh
cd 'Synap AT'
python3 server.py
```

Open http://127.0.0.1:4174. No dependency installation is needed for local preview.

## Host with Docker

```sh
docker build -t synap-at .
docker volume create synap-at-data
docker run -d --name synap-at --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -e PUBLIC_ORIGIN=https://YOUR_DOMAIN \
  -v synap-at-data:/app/data synap-at
```

Put the container behind an HTTPS reverse proxy. Replace YOUR_DOMAIN with the exact public origin. Alternatively install requirements.txt in a virtual environment and run `gunicorn --bind 127.0.0.1:8080 --workers 2 server:app`.

The form requires this Python service. A static only host will render the page but will not receive enquiries. Use persistent storage, back it up, restrict host access and set an appropriate retention policy before public launch.

## Prospect enquiries

Validated submissions are saved to private SQLite storage under DATA_DIR, defaulting to ./data. They are never served by the website. Success appears only after a committed database write. No recipient address has been supplied, so email delivery is not configured. Export received leads on the host:

```sh
python3 export_enquiries.py > enquiries.csv
# With Docker:
docker exec synap-at python export_enquiries.py > enquiries.csv
```

The form includes consent, a hidden bot field, body limits, server validation, an origin check and a basic database backed rate limit. Add edge bot protection for public traffic. The app intentionally does not trust forwarded client IP headers; behind a reverse proxy the rate limit is shared by that proxy address. Configure edge limits accordingly. No public administration endpoint exists.

## Content and launch handoff

Visible copy contains no hyphen or dash characters. Theme matches synapdome.com with dark navy surfaces, emerald accents, Inter typography and rounded controls. Assets include the supplied SynapDome logo. Fonts use Google Fonts with local system fallbacks. No testimonials, fabricated customers or numeric price claims are included.

The service catalog covers web, mobile, API, cloud, delivery pipeline and network reviews. Capability reference: https://github.com/CyberStrikeus/CyberStrike#agents and its MCP ecosystem section. Actual delivery depends on agreed access, tooling and scope.

The requested 48 hour refund offer is included. The page describes kickoff after scope and access confirmation; record the agreed delivery and refund terms in client proposals. Before hosting, the business owner should finalize the offer terms, privacy notice and lead handling process. The site is a lead enquiry page, not a booking or payment system.

## Checks

```sh
python3 -m unittest test_server.py
```
