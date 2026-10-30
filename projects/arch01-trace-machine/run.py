"""Run bounded Node verification from an isolated temporary source copy."""
import argparse,datetime,hashlib,json,platform,shutil,subprocess,tempfile,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PID='arch01-trace-machine'
SOURCE=[f'projects/{PID}/'+f for f in ('README.md','MODEL.md','run.py','verify.js')]+['assets/js/demos/'+id+'.js' for id in ('arch-logic-fsm','arch-datapath-control','arch-pipeline-timing','arch-cache')]
INPUT=[f'projects/{PID}/fixtures.json']
def manifest(paths):return [dict(path=p,sha256=hashlib.sha256((ROOT/p).read_bytes()).hexdigest()) for p in paths]
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='results/arch01-trace-machine');args=parser.parse_args()
    out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
    node=shutil.which('node')
    if not node:raise SystemExit('需要Node.js（无npm依赖），请安装后运行。')
    date=datetime.datetime.now(datetime.timezone.utc).isoformat()
    result=dict(schemaVersion=1,projectId=PID,projectRevision=1,targetId='node-local',runId='arch01-'+date.replace(':','-'),recordedAt=date,
      environment=dict(python=platform.python_version(),os=platform.system().lower(),architecture=platform.machine(),node=subprocess.check_output([node,'--version'],text=True,timeout=10).strip()),
      config=dict(model='RV32I-text-subset',wordBits=32,memoryBytes=256,endianness='little',seed=20261022,timeoutSeconds=30,isolatedTemporaryCopy=True),
      command=['python','-B','-X','utf8',f'projects/{PID}/run.py','--out',str(args.out)],sourceManifest=manifest(SOURCE),inputManifest=manifest(INPUT),assertions=[],measurements=[],status='failed')
    try:
      with tempfile.TemporaryDirectory(prefix='kg-arch01-') as folder:
        temp=Path(folder)
        for rel in SOURCE+INPUT:
          target=temp/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/rel,target)
        proc=subprocess.run([node,str(temp/f'projects/{PID}/verify.js'),str(temp)],cwd=temp,capture_output=True,text=True,encoding='utf8',timeout=30)
        (out/'node-stdout.json').write_text(proc.stdout,encoding='utf8');(out/'node-stderr.txt').write_text(proc.stderr,encoding='utf8')
        if proc.returncode:raise RuntimeError(proc.stderr.strip() or 'Node exit '+str(proc.returncode))
        raw=json.loads(proc.stdout);result['environment']['nodeProcessArchitecture']=raw['environment']['architecture'];result['environment']['architecture']={'x64':'x86_64','arm64':'aarch64'}.get(raw['environment']['architecture'],'unspecified');result['assertions']=raw['assertions'];result['measurements']=raw['measurements'];result['events']=raw['trace'];result['status']='passed'
        (out/'sequential-trace.json').write_text(json.dumps(raw['trace'],ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        (out/'pipeline-cycles.json').write_text(json.dumps(raw['pipeline'],ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    except (subprocess.TimeoutExpired,RuntimeError,ValueError) as error:
      result['missingReason']=str(error);result['assertions'].append(dict(name='bounded isolated execution',passed=False))
    (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(dict(status=result['status'],assertions=len(result['assertions']),result=str(out/'results.json')),ensure_ascii=False))
    if result['status']!='passed':raise SystemExit(1)
if __name__=='__main__':main()
