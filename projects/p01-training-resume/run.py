"""CPU reference experiment. Run from this directory: python run.py --out results"""
import argparse,copy,hashlib,json,platform,time
from pathlib import Path
import torch

def run(out,seed=17):
 start=time.perf_counter();torch.set_num_threads(1);torch.manual_seed(seed)
 x=torch.linspace(-2,2,90).reshape(-1,1);y=2*x+1+0.03*torch.randn_like(x)
 ids=torch.randperm(len(x));train,valid,test=ids[:54],ids[54:72],ids[72:]
 assert len(set(train.tolist()) & set(test.tolist()))==0
 mean=x[train].mean();std=x[train].std();z=(x-mean)/std
 def create():
  model=torch.nn.Linear(1,1);opt=torch.optim.SGD(model.parameters(),lr=0.08,momentum=0.7)
  return model,opt
 def step(model,opt):
  model.train();opt.zero_grad(set_to_none=True)
  pred=model(z[train]);assert pred.shape==y[train].shape
  loss=(pred-y[train]).square().mean();loss.backward();opt.step()
  return loss.item()
 def metric(model,indices):
  model.eval()
  with torch.no_grad():return (model(z[indices])-y[indices]).square().mean().item()
 m,opt=create();initial=metric(m,train);history=[];best=None;best_val=float('inf')
 for epoch in range(30):
  loss=step(m,opt);val=metric(m,valid);history.append(dict(epoch=epoch+1,train_before_update=loss,validation_after_update=val))
  if val<best_val:best_val=val;best=copy.deepcopy(m.state_dict())
 out.mkdir(parents=True,exist_ok=True)
 checkpoint={'model':copy.deepcopy(m.state_dict()),'optimizer':copy.deepcopy(opt.state_dict()),'rng':torch.get_rng_state(),'epoch':30,'seed':seed,'mean':mean,'std':std,'train_ids':train,'valid_ids':valid,'test_ids':test}
 torch.save(checkpoint,out/'checkpoint.pt')
 for _ in range(5):step(m,opt)
 expected=copy.deepcopy(m.state_dict())
 restored,ropt=create();saved=torch.load(out/'checkpoint.pt',weights_only=True,map_location='cpu')
 restored.load_state_dict(saved['model']);ropt.load_state_dict(saved['optimizer']);torch.set_rng_state(saved['rng'])
 assert torch.equal(restored(z),torch.nn.functional.linear(z,saved['model']['weight'],saved['model']['bias']))
 for _ in range(5):step(restored,ropt)
 for key in expected:assert torch.equal(expected[key],restored.state_dict()[key]),key
 # Evaluate the validation-selected snapshot exactly once on held-out test data.
 restored.load_state_dict(best);test_mse=metric(restored,test)
 baseline=((y[test]-y[train].mean())**2).mean().item()
 assert metric(restored,train)<initial
 result={'seed':seed,'initial_train_mse':initial,'best_validation_mse':best_val,'test_mse':test_mse,'constant_baseline_test_mse':baseline,'resume_equal':True,'history':history,'split':{'train':train.tolist(),'validation':valid.tolist(),'test':test.tolist()},'normalization':{'mean':mean.item(),'std':std.item()},'environment':{'python':platform.python_version(),'torch':torch.__version__,'device':'cpu','threads':1},'seconds':time.perf_counter()-start,'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
 (out/'results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({k:result[k] for k in ['test_mse','constant_baseline_test_mse','resume_equal','seconds']}))
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=Path('results'));p.add_argument('--seed',type=int,default=17);args=p.parse_args();run(args.out,args.seed)
