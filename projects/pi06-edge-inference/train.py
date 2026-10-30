"""Train on the computer, export safe small JSON; Pi does not require PyTorch."""
import argparse
import json
from pathlib import Path
import numpy as np
import torch
from model_format import digest,load_model,predict
def train(out):
    torch.set_num_threads(1);torch.manual_seed(17);rng=np.random.default_rng(17)
    # Train and fixed test are independently drawn; fit preprocessing only on train.
    train_x=rng.normal(size=(128,3)).astype(np.float32)
    test_x=rng.normal(size=(8,3)).astype(np.float32)
    true_w=np.array([2.,-1.,.5],np.float32);train_y=train_x@true_w+np.float32(.3)
    mean=train_x.mean(0);scale=train_x.std(0);x=torch.from_numpy((train_x-mean)/scale);y=torch.from_numpy(train_y[:,None])
    model=torch.nn.Linear(3,1);optimizer=torch.optim.SGD(model.parameters(),lr=.1)
    model.train()
    for _ in range(250):
        optimizer.zero_grad();loss=torch.nn.functional.mse_loss(model(x),y);loss.backward();optimizer.step()
    model.eval()
    with torch.no_grad():reference=model(torch.from_numpy((test_x-mean)/scale)).squeeze(1).numpy()
    p={'formatVersion':1,'featureOrder':['x0','x1','x2'],'dtype':'float32','inputShape':[None,3],
       'weight':model.weight.detach().numpy().reshape(3).tolist(),'bias':model.bias.detach().numpy()[0].item(),
       'mean':mean.tolist(),'scale':scale.tolist(),'fitSplit':'training-only','atol':1e-6,'rtol':1e-5,
       'testInput':test_x.tolist(),'referencePrediction':reference.tolist(),'seed':17,
       'producer':{'numpy':np.__version__,'torch':str(torch.__version__),'trainCount':128,'testCount':8,'steps':250,'trainingMse':float(loss.detach())}}
    out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'payload':p,'sha256':digest(p)},indent=2,allow_nan=False)+'\n',encoding='utf-8')
    verified=load_model(out)
    if not np.allclose(predict(verified,test_x),reference,atol=1e-6,rtol=1e-5):raise AssertionError('export differs from PyTorch reference')
    print(out)
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=Path('model.json'));args=parser.parse_args();train(args.out)
