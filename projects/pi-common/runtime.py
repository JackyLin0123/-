"""Bounded local experiment runtime. Standard library only; never guesses Pi evidence."""
import argparse
import hashlib
import json
import os
import platform
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def input_record(path):
    path=Path(path).resolve()
    if path.is_relative_to(ROOT):
        return {'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path),'scope':'repository'}
    return {'path':'external/'+path.name,'sha256':sha(path),'scope':'external','reason':'external user input; not a checked repository artifact'}

def windows_job(child):
    """Assign our process to a kill-on-close job, including future descendants."""
    if os.name!='nt':return None
    import ctypes
    from ctypes import wintypes
    class Basic(ctypes.Structure):
        _fields_=[('processTime',ctypes.c_longlong),('jobTime',ctypes.c_longlong),('flags',wintypes.DWORD),('minWorking',ctypes.c_size_t),('maxWorking',ctypes.c_size_t),('activeLimit',wintypes.DWORD),('affinity',ctypes.c_size_t),('priority',wintypes.DWORD),('scheduling',wintypes.DWORD)]
    class IO(ctypes.Structure):_fields_=[(name,ctypes.c_ulonglong) for name in ('readOperations','writeOperations','otherOperations','readBytes','writeBytes','otherBytes')]
    class Extended(ctypes.Structure):_fields_=[('basic',Basic),('io',IO),('processMemory',ctypes.c_size_t),('jobMemory',ctypes.c_size_t),('peakProcessMemory',ctypes.c_size_t),('peakJobMemory',ctypes.c_size_t)]
    kernel=ctypes.WinDLL('kernel32',use_last_error=True)
    kernel.CreateJobObjectW.restype=wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes=[wintypes.HANDLE,ctypes.c_int,ctypes.c_void_p,wintypes.DWORD]
    kernel.AssignProcessToJobObject.argtypes=[wintypes.HANDLE,wintypes.HANDLE]
    kernel.CloseHandle.argtypes=[wintypes.HANDLE]
    handle=kernel.CreateJobObjectW(None,None)
    limits=Extended();limits.basic.flags=0x2000
    if not handle or not kernel.SetInformationJobObject(handle,9,ctypes.byref(limits),ctypes.sizeof(limits)) or not kernel.AssignProcessToJobObject(handle,int(child._handle)):
        if handle:kernel.CloseHandle(handle)
        child.terminate();child.wait()
        raise OSError('cannot establish bounded Windows job; refusing uncontained child')
    return lambda:kernel.CloseHandle(handle)

def read_text(path):
    try:
        return Path(path).read_text().strip().strip('\x00')
    except (OSError, UnicodeError):
        return None

def thermal():
    temp = read_text('/sys/class/thermal/thermal_zone0/temp')
    freq = read_text('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq')
    throttle = None
    if shutil.which('vcgencmd'):
        try:
            raw = subprocess.run(['vcgencmd', 'get_throttled'], capture_output=True, text=True, timeout=2)
            if raw.returncode == 0:
                bits = int(raw.stdout.strip().split('=')[-1], 16)
                throttle = {'raw': hex(bits), 'current': bits & 15, 'historical': (bits >> 16) & 15}
        except (ValueError, subprocess.SubprocessError, OSError):
            pass
    return {'recordedAt': datetime.now(timezone.utc).isoformat(),
            'temperatureC': float(temp)/1000 if temp and temp.isdigit() else None,
            'frequencyKHz': int(freq) if freq and freq.isdigit() else None, 'throttling': throttle}

def available_memory():
    text = read_text('/proc/meminfo') or ''
    for line in text.splitlines():
        if line.startswith('MemAvailable:'):
            return int(line.split()[1])*1024
    if os.name == 'nt':
        import ctypes
        class Memory(ctypes.Structure):
            _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [(k, ctypes.c_ulonglong) for k in ('total', 'available', 'pageTotal', 'pageAvailable', 'virtualTotal', 'virtualAvailable', 'extended')]
        data = Memory(); data.length = ctypes.sizeof(data)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(data)):
            return data.available
    return None

def environment():
    model = read_text('/proc/device-tree/model') or 'unknown'
    mem = read_text('/proc/meminfo') or ''
    total = next((int(line.split()[1])*1024 for line in mem.splitlines() if line.startswith('MemTotal:')), None)
    reported=platform.machine()
    process_raw=reported or 'unknown';native_raw='unknown';architecture_source='platform.machine'
    if os.name=='nt':
        import ctypes
        names={0:'x86',5:'arm',9:'x86_64',12:'aarch64'}
        try:
            data=ctypes.create_string_buffer(64);ctypes.windll.kernel32.GetSystemInfo(ctypes.byref(data))
            process_raw=names.get(ctypes.c_ushort.from_buffer(data).value,'unknown')
            ctypes.windll.kernel32.GetNativeSystemInfo(ctypes.byref(data))
            native_raw=names.get(ctypes.c_ushort.from_buffer(data).value,'unknown')
            architecture_source='Windows GetSystemInfo (process) and GetNativeSystemInfo (native)'
        except (OSError,AttributeError):pass
    architecture = {'AMD64':'x86_64','arm64':'aarch64','x86_64':'x86_64','aarch64':'aarch64'}.get(process_raw,'unspecified')
    return {'os': platform.system().lower(), 'osVersion': platform.version(), 'release': read_text('/etc/os-release'),
            'architecture': architecture, 'reportedArchitecture':reported or 'unknown', 'processArchitecture':process_raw,
            'nativeArchitecture':native_raw,'architectureSource':architecture_source,'hardware': model, 'python': platform.python_version(),
            'userlandBits': 64 if sys.maxsize > 2**32 else 32, 'memoryTotalBytes': total,
            'memoryAvailableBytes': available_memory(), 'storageFreeBytes': shutil.disk_usage(Path.cwd()).free,
            'powerSupply': 'unknown-user-record-required', 'cooling': 'unknown-user-record-required'}

class Run:
    def __init__(self, project, args, inputs=()):
        self.start = time.monotonic(); self.budget = args.budget; self.build_directories=[]
        self.out = Path(args.out).resolve(); self.out.mkdir(parents=True, exist_ok=True)
        env = environment()
        target = 'pi5-linux-aarch64' if ('Raspberry Pi 5' in env['hardware'] and env['os']=='linux' and env['architecture']=='aarch64') else env['os']+'-'+env['architecture']
        sources = list((ROOT/'projects'/project).glob('*.py'))+list((ROOT/'projects'/project).glob('*.c'))+[Path(__file__)]
        sources += list((ROOT/'projects'/project).glob('requirements*.txt'))+list((ROOT/'projects'/project).glob('README.md'))
        self.result = {'schemaVersion':1, 'projectId':project, 'projectRevision':1,
                       'targetId':target, 'runId':str(uuid.uuid4()), 'recordedAt':datetime.now(timezone.utc).isoformat(),
                       'origin':'measured', 'status':'passed', 'environment':env, 'command': ['python']+sys.argv,
                       'sourceManifest':[{'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p)} for p in sorted(sources)],
                       'inputManifest':[input_record(p) for p in inputs],
                       'config':{'budgetSeconds':args.budget}, 'measurements':[], 'events':[], 'assertions':[], 'missing':[], 'thermal':[thermal()]}
    def remaining(self):
        left = self.budget - (time.monotonic()-self.start)
        if left <= 0:
            raise TimeoutError('experiment budget exhausted; remaining configurations cancelled')
        return left
    def guard(self):
        self.remaining(); sample = thermal(); self.result['thermal'].append(sample)
        bits = sample['throttling']
        if (sample['temperatureC'] is not None and sample['temperatureC'] >= 80) or (bits and bits['current']):
            self.result['performanceStatus']='affected'
            raise RuntimeError('current thermal/undervoltage condition: stop subsequent performance samples')
    def command(self, argv, cwd=None):
        kwargs = {'cwd':cwd, 'stdout':subprocess.PIPE, 'stderr':subprocess.PIPE, 'text':True, 'encoding':'utf-8', 'errors':'replace'}
        if os.name != 'nt': kwargs['start_new_session'] = True
        child = subprocess.Popen([str(x) for x in argv], **kwargs)
        close_job=windows_job(child)
        try:
            stdout, stderr = child.communicate(timeout=min(60, self.remaining()))
        except (BaseException,):
            if os.name != 'nt':
                try:os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:pass
            else:
                close_job();close_job=None
            try: child.communicate(timeout=2)
            except subprocess.TimeoutExpired: child.kill(); child.communicate()
            raise
        finally:
            if close_job:close_job()
        if child.returncode: raise RuntimeError('command failed: '+str(argv)+'\n'+stderr[:4000])
        return stdout
    def compile(self, name, flags=()):
        cc = os.environ.get('CC','gcc')
        self.result['environment']['compiler'] = self.command([cc,'--version']).splitlines()[0]
        build=self.build_directory()
        shutil.copyfile(ROOT/'projects'/self.result['projectId']/(name+'.c'),build/(name+'.c'))
        exe = build/(name+('.exe' if os.name=='nt' else ''))
        self.command([cc,'-std=c11','-Wall','-Wextra','-Werror','-O2',*flags,name+'.c','-o',exe.name],cwd=build)
        shutil.copyfile(exe,self.out/exe.name)
        return exe
    def build_directory(self):
        # Some Windows binutils cannot write Unicode paths. Python copies only our
        # owned source into a private ASCII-named temporary build directory.
        temporary=tempfile.TemporaryDirectory(prefix='kg-pi-build-');self.build_directories.append(temporary)
        return Path(temporary.name)
    def check(self, name, passed, detail=''):
        self.result['assertions'].append({'name':name,'passed':bool(passed),'detail':str(detail)})
        if not passed: self.result['status']='failed'
    def measure(self, name, unit, data, kind='samples'):
        self.result['measurements'].append({'name':name,'type':kind,'unit':unit,'data':data})
    def skip(self, reason):
        self.result['status']='skipped'; self.result['missing'].append({'metric':'required branch','status':'skipped','reason':reason})
    def finish(self):
        self.result['thermal'].append(thermal())
        latest=self.result['thermal'][-1]
        if (latest['temperatureC'] is not None and latest['temperatureC']>=80) or (latest['throttling'] and latest['throttling']['current']):
            self.result['performanceStatus']='affected'
            self.result['missing'].append({'metric':'performance validity','status':'skipped','reason':'current thermal/undervoltage at run end; retain correctness, exclude performance comparison'})
        if any(s['temperatureC'] is None or s['frequencyKHz'] is None for s in self.result['thermal']):
            if 'performanceStatus' not in self.result:self.result['performanceStatus']='insufficient-information'
            self.result['missing'].append({'metric':'performance environment','status':'skipped','reason':'temperature/frequency unavailable: correctness only; do not compare device performance'})
        self.result.setdefault('performanceStatus','valid')
        self.result['elapsedSeconds']=time.monotonic()-self.start
        (self.out/'results.json').write_text(json.dumps(self.result,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
        print(str(self.out/'results.json'))
        for directory in self.build_directories: directory.cleanup()
        return 0 if self.result['status']!='failed' else 1

def parser(description):
    p=argparse.ArgumentParser(description=description)
    p.add_argument('--out',default='results'); p.add_argument('--budget',type=float,default=60)
    return p

def execute(project, task, extra=None):
    p=parser(project)
    if extra: extra(p)
    args=p.parse_args()
    if not 1 <= args.budget <= 300: p.error('--budget must be within 1..300 seconds')
    run=Run(project,args)
    try: task(run,args)
    except KeyboardInterrupt:
        run.result['status']='cancelled'; run.result['missing'].append({'metric':'run','status':'cancelled','reason':'user interrupted; child reclaimed'})
    except Exception as exc:
        run.result['status']='failed'; run.result['missing'].append({'metric':'run','status':'failed','reason':str(exc)})
    code=run.finish()
    if run.result['status']=='cancelled': code=130
    raise SystemExit(code)
