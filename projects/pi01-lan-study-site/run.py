"""Serve only an explicit exported public directory; no repository-root serving."""
import functools
import http.server
import ipaddress
import json
import sys
import threading
import time
import urllib.request
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'pi-common'))
from runtime import execute, ROOT, sha
def options(p):
    p.add_argument('--site',required=True); p.add_argument('--bind',default='127.0.0.1')
    p.add_argument('--port',type=int,default=8080); p.add_argument('--serve',action='store_true')
def task(run,args):
    address=ipaddress.ip_address(args.bind)
    if not (address.is_loopback or address.is_private) or address.is_unspecified:
        raise ValueError('choose a particular loopback or LAN address, not wildcard/public address')
    if not 0 <= args.port <= 65535: raise ValueError('invalid port')
    site=Path(args.site).resolve()
    if site==ROOT or not (site/'index.html').is_file() or not (site/'assets').is_dir(): raise ValueError('use _build/export_public.py output, never repository root')
    manifest_path=site/'public-manifest.json'
    if not manifest_path.is_file():raise ValueError('public-manifest.json missing: use the public exporter')
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    if manifest.get('kind')!='public-static-site' or not isinstance(manifest.get('files'),dict):raise ValueError('invalid public manifest')
    forbidden={'.git','.env','.ssh','.codex','.agents','checkpoints','research'}
    for entry in site.rglob('*'):
        if entry.is_symlink() or any(part in forbidden for part in entry.relative_to(site).parts): raise ValueError('private path/symlink in public directory')
        if entry.is_file() and entry!=manifest_path:
            record=manifest['files'].get(entry.relative_to(site).as_posix())
            if not isinstance(record,dict) or record.get('sha256')!=sha(entry):raise ValueError('unexpected or changed public file; export again')
    handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(site))
    with http.server.ThreadingHTTPServer((args.bind,args.port),handler) as server:
        thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        try:
            url=f'http://{args.bind}:{server.server_port}/'
            with urllib.request.urlopen(url,timeout=min(5,run.remaining())) as response:
                run.check('exported index reachable',response.status==200 and b'<html' in response.read().lower())
            run.result['config'].update({'url':url,'directory':site.name,'storage':'current browser and origin only'})
            print('Local HTTP check passed: '+url)
            print('Loopback is local-only; use --bind with the actual Pi LAN address for a phone.' if address.is_loopback else 'Phone URL on the same LAN: '+url)
            print('Ctrl+C stops. Browser progress is stored per browser/origin, not automatically synchronized.')
            if args.serve:
                deadline=run.start+run.budget
                while time.monotonic()<deadline: time.sleep(min(0.25,max(0,deadline-time.monotonic())))
        finally: server.shutdown(); thread.join(timeout=3)
    run.result['missing'].append({'metric':'phone LAN acceptance','status':'skipped','reason':'requires actual phone flipping, answer, refresh, import/cancel/restore; loopback is not phone proof'})
execute('pi01-lan-study-site',task,options)
