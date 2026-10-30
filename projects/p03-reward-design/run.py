"""Compare task success and shaped training reward on a tiny grid. No ML libraries."""
import argparse,json,random,platform,math
from pathlib import Path

def transition(state,action,bonus=False):
 if state==8:return 8,0.,True
 row,col=divmod(state,3);dr,dc=[(0,1),(1,0),(0,-1),(-1,0),(0,0)][action]
 r,c=row+dr,col+dc;nxt=state if not (0<=r<3 and 0<=c<3) else r*3+c
 done=nxt==8
 reward=10. if done else (2. if bonus and action==4 else -1.)
 return nxt,reward,done

def experiment(seed,bonus):
 rng=random.Random(seed);q=[[0.]*5 for _ in range(9)];training=[]
 for episode in range(400):
  state=0;reward_sum=0.
  for t in range(100):
   action=rng.randrange(5) if rng.random()<0.2 else max(range(5),key=lambda a:q[state][a])
   nxt,reward,done=transition(state,action,bonus)
   target=reward+(0 if done else 0.9*max(q[nxt]))
   q[state][action]+=0.2*(target-q[state][action]);state=nxt;reward_sum+=reward
   if done:break
  training.append({'episode':episode,'reward':reward_sum,'success':state==8,'steps':t+1})
 state=0;trajectory=[];total=0.
 for t in range(30):
  action=max(range(5),key=lambda a:q[state][a]);nxt,reward,done=transition(state,action,bonus)
  trajectory.append({'state':state,'action':action,'next':nxt,'reward':reward});total+=reward;state=nxt
  if done:break
 assert all(math.isfinite(v) for row in q for v in row)
 return {'seed':seed,'reward_mode':'stay-bonus' if bonus else 'task-aligned','training':training,'q':q,'evaluation':{'success':state==8,'reward':total,'steps':len(trajectory),'trajectory':trajectory}}

def run(out):
 assert transition(0,2)[0]==0
 assert transition(7,0)==(8,10.,True)
 assert transition(0,4,True)==(0,2.,False)
 records=[experiment(seed,bonus) for seed in [1,7,17] for bonus in [False,True]]
 out.mkdir(parents=True,exist_ok=True)
 report={'environment':{'python':platform.python_version(),'device':'cpu','external_dependencies':[]},'protocol':{'grid':'3x3','start':0,'goal':8,'actions':['right','down','left','up','stay'],'gamma':0.9,'alpha':0.2,'epsilon':0.2,'episodes':400,'collection_limit':100,'evaluation_limit':30,'termination':'goal only; collection truncation retains bootstrap','seeds':[1,7,17]},'hypothesis':'A stay bonus may increase reward while reducing goal success. This is not forced by assertions.','records':records}
 (out/'results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
 print([(r['seed'],r['reward_mode'],r['evaluation']['success'],r['evaluation']['reward']) for r in records]);return report
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--out',type=Path,default=Path('results'));run(p.parse_args().out)
