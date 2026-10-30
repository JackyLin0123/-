"""Compile checked-in Java into a clean temporary directory; record exact evidence."""
import argparse
import datetime
import hashlib
import json
import platform
from pathlib import Path
import subprocess
import tempfile
import time

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
def manifest(paths):
    return [dict(path=p.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(paths)]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='results/se01');args=parser.parse_args()
    out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    commands=[];assertions=[];logs=[]
    result=dict(schemaVersion=1,projectId='se01-reservation-evolution',projectRevision=1,
      targetId='windows-x86_64' if platform.system()=='Windows' else 'other-local',
      runId='se01-'+str(time.time_ns()),recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
      environment=dict(os=platform.system().lower(),architecture=platform.machine(),python=platform.python_version()),
      command=['python','projects/se01-reservation-evolution/run.py','--out',args.out],
      config=dict(model='single-thread half-open nonnegative integer slots',timeoutSeconds=30),
      sourceManifest=manifest([Path(__file__).resolve()]+list((HERE/'src').glob('*.java'))),
      inputManifest=manifest((HERE/'fixtures').glob('*.txt')),assertions=assertions,measurements=[],status='failed')
    def run(command,**kwargs):
        commands.append(command)
        proc=subprocess.run(command,text=True,encoding='utf8',capture_output=True,timeout=30,**kwargs)
        logs.append('$ '+' '.join(command)+'\n'+proc.stdout+proc.stderr)
        if proc.returncode:raise RuntimeError('command failed: '+command[0])
        return proc.stdout+proc.stderr
    try:
        result['environment']['java']=run(['java','-version']).strip()
        result['environment']['javac']=run(['javac','-version']).strip()
        with tempfile.TemporaryDirectory(prefix='kg-se01-') as temp:
            run(['javac','-encoding','UTF-8','-d',temp]+[str(p) for p in sorted((HERE/'src').glob('*.java'))])
            test=run(['java','-ea','-cp',temp,'ContractTests'])
            assertions.append(dict(name='four store/refactor variants and independent 225-pair oracle',passed='PASS exhaustive 225 interval pairs x 4 variants' in test))
            assertions.append(dict(name='expected-red alias and closed boundary witnesses detected then fixed',passed='PASS expected-red witnesses' in test))
            assertions.append(dict(name='same empty active set has distinct future allocation behavior; four variants retain history',passed='PASS allocation-history distinct empty abstract states x 4 variants' in test))
            expected=(HERE/'fixtures/expected-cli.txt').read_text(encoding='utf8').strip()
            for store in ('list','tree'):
                actual=run(['java','-ea','-cp',temp,'ReservationCli',store],input=(HERE/'fixtures/cli.txt').read_text(encoding='utf8'))
                assertions.append(dict(name='CLI '+store+' exact fixture',passed=actual.strip()==expected))
        result['status']='passed' if assertions and all(a['passed'] for a in assertions) else 'failed'
    except (OSError,subprocess.SubprocessError,RuntimeError) as error:
        result['reason']=str(error)
    result['executedCommands']=commands
    (out/'run.log').write_text('\n'.join(logs),encoding='utf8')
    (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(dict(status=result['status'],assertions=assertions,resultPath=str(out/'results.json')),ensure_ascii=False))
    return 0 if result['status']=='passed' else 1
if __name__=='__main__':raise SystemExit(main())
