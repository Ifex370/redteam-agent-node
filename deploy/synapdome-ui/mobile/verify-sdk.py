#!/usr/bin/env python3
from pathlib import Path
import sys
root=Path(sys.argv[1])
expected={'emulator':'37.2.13','platform-tools':'37.0.1','system-images/android-35/google_apis/arm64-v8a':'9'}
for package,revision in expected.items():
    p=root/package/'source.properties'
    lines=p.read_text().splitlines()
    actual=next((v.split('=',1)[1].strip() for v in lines if v.startswith('Pkg.Revision=')),None)
    if actual != revision:
        sys.exit(f'{package}: expected {revision}, got {actual}. Restore the approved SDK archive; do not silently upgrade the stable lab.')
print('SDK revisions match the laptop baseline.')
