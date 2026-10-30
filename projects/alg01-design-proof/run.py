"""Compile/run the Java lab in a clean temporary directory, record versioned evidence."""
import argparse
import datetime
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def manifest(names):
    return [{'path':(HERE/name).relative_to(ROOT).as_posix(),'sha256':digest(HERE/name)} for name in names]

def architecture():
    if os.name=='nt':
        import ctypes
        data=ctypes.create_string_buffer(64)
        ctypes.windll.kernel32.GetNativeSystemInfo(ctypes.byref(data))
        return {0:'x86',5:'arm',9:'x86_64',12:'aarch64'}.get(ctypes.c_ushort.from_buffer(data).value,'unknown')
    return platform.machine() or 'unknown'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',default='results/alg01-design-proof')
    args=parser.parse_args()
    out=Path(args.out).resolve()
    out.mkdir(parents=True,exist_ok=True)
    recorded=datetime.datetime.now(datetime.timezone.utc).isoformat()
    native_arch=architecture()
    result=dict(schemaVersion=1,projectId='alg01-design-proof',projectRevision=1,targetId='windows-x86_64' if platform.system()=='Windows' and native_arch=='x86_64' else 'local-jdk',runId=str(uuid.uuid4()),recordedAt=recorded,
      environment=dict(os=platform.system().lower(),osVersion=platform.version(),architecture=native_arch,architectureSource='GetNativeSystemInfo' if os.name=='nt' else 'platform.machine',python=platform.python_version(),java='unavailable',javac='unavailable'),
      command=['python','-B','-X','utf8','projects/alg01-design-proof/run.py','--out',args.out],
      sourceManifest=manifest(['Algorithms.java','BruteOracle.java','LabTest.java','run.py','README.md','PROOFS.md']),inputManifest=manifest(['fixtures.json']),
      config=dict(timeoutPerCommandSeconds=30,javaStandard='17+',enumeration='deterministic bounded exhaustive',proofStatus='separate human-reviewable PROOFS.md, not certified by test'),status='failed',assertions=[],measurements=[])
    actual_stdout=''
    actual_stderr=''
    try:
        if shutil.which('java') is None or shutil.which('javac') is None:
            result['status']='skipped';result['reason']='JDK java/javac not found on PATH';return_code=2
        else:
            for tool in ('java','javac'):
                version=subprocess.run([tool,'-version'],capture_output=True,text=True,encoding='utf8',errors='replace',timeout=10,check=True)
                result['environment'][tool]=(version.stdout+version.stderr).strip()
            with tempfile.TemporaryDirectory(prefix='kg-alg01-') as task_temp:
                work=Path(task_temp)
                for name in ('Algorithms.java','BruteOracle.java','LabTest.java'):shutil.copy2(HERE/name,work/name)
                sources=['Algorithms.java','BruteOracle.java','LabTest.java']
                compile_command=['javac','-encoding','UTF-8','-d','classes']+sources
                compiled=subprocess.run(compile_command,cwd=work,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=30)
                if compiled.returncode:raise RuntimeError('javac failed: '+compiled.stdout+compiled.stderr)
                execution=['java','-cp','classes','LabTest']
                run=subprocess.run(execution,cwd=work,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=30)
                actual_stdout=run.stdout;actual_stderr=run.stderr
                if run.returncode:raise RuntimeError('Java tests failed: '+run.stderr)
                summary=json.loads(run.stdout)
                fixture=json.loads((HERE/'fixtures.json').read_text(encoding='utf8'))
                expected={'inversions':fixture['inversions']['expected'],'knapsack':fixture['knapsack']['expected'],'wrongKnapsack':fixture['knapsack']['wrongForwardExpected'],'greedyWeight':fixture['weightedIntervals']['greedyExpected'],'optimalWeight':fixture['weightedIntervals']['optimumExpected'],'lcsLength':fixture['lcs']['expectedLength'],'flow':fixture['flow']['expected']}
                result['assertions']=[dict(name='fixture-'+key,passed=summary.get(key)==value) for key,value in expected.items()]
                result['assertions'].append(dict(name='LCS-returned-answer-in-two-fixture-alternatives',passed=summary.get('lcs') in fixture['lcs']['possibleAnswers']))
                result['assertions'].append(dict(name='Java-enumeration-assertions-completed',passed=summary['assertions']>0))
                result['measurements']=[dict(type='groups',unit='finite instances',data=[dict(task=key,cases=value) for key,value in summary['cases'].items()]),dict(type='groups',unit='assertions',data=[dict(total=summary['assertions'])])]
                result['summary']=summary
                result['executedCommands']=[compile_command,execution]
                result['status']='passed' if all(x['passed'] for x in result['assertions']) else 'failed'
                return_code=0 if result['status']=='passed' else 1
    except (OSError,subprocess.SubprocessError,RuntimeError,ValueError,KeyError) as error:
        result['status']='failed';result['reason']=str(error);return_code=1
    (out/'stdout.txt').write_text(actual_stdout,encoding='utf8')
    (out/'stderr.txt').write_text(actual_stderr,encoding='utf8')
    (out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps(dict(status=result['status'],resultPath=str(out/'results.json'),summary=result.get('summary'),reason=result.get('reason')),ensure_ascii=False))
    return return_code

if __name__=='__main__':sys.exit(main())
