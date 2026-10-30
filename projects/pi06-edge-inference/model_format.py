"""Strict transport format shared by exporter and NumPy inference; no pickle/checkpoint loading."""
import hashlib
import json
import numpy as np
FIELDS={'formatVersion','featureOrder','dtype','inputShape','weight','bias','mean','scale','fitSplit','atol','rtol','testInput','referencePrediction','seed','producer'}
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
def digest(value):return hashlib.sha256(canonical(value)).hexdigest()
def load_model(path):
    raw=path.read_bytes()
    if len(raw)>1024*1024:raise ValueError('model exceeds 1 MiB')
    bundle=json.loads(raw)
    if not isinstance(bundle,dict) or set(bundle)!={'payload','sha256'} or bundle['sha256']!=digest(bundle['payload']):raise ValueError('model fingerprint mismatch')
    p=bundle['payload']
    if not isinstance(p,dict) or set(p)!=FIELDS or p['formatVersion']!=1 or p['dtype']!='float32' or p['fitSplit']!='training-only' or p['featureOrder']!=['x0','x1','x2'] or p['inputShape']!=[None,3]:raise ValueError('unsupported model contract')
    shapes={'weight':(3,),'bias':(),'mean':(3,),'scale':(3,),'testInput':(8,3),'referencePrediction':(8,)}
    for key,shape in shapes.items():
        value=np.asarray(p[key],dtype=np.float32)
        if value.shape!=shape or not np.isfinite(value).all():raise ValueError('invalid '+key)
    if np.any(np.asarray(p['scale'])<=0):raise ValueError('nonpositive scale')
    if p['atol']!=1e-6 or p['rtol']!=1e-5:raise ValueError('unexpected tolerance: use new format version for revised protocol')
    return p
def predict(p,x):
    x=np.asarray(x,dtype=np.float32)
    if x.ndim!=2 or x.shape[1]!=3 or not np.isfinite(x).all():raise ValueError('input must be finite [batch,3] float32')
    return ((x-np.asarray(p['mean'],dtype=np.float32))/np.asarray(p['scale'],dtype=np.float32))@np.asarray(p['weight'],dtype=np.float32)+np.float32(p['bias'])
