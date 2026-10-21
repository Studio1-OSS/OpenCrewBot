#!/usr/bin/env python3
"""Reproducible local-only OpenLore service. No credentials are printed."""
from pathlib import Path
import os,sys,json,shutil,subprocess,time,platform,hashlib,urllib.request,signal
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=ROOT/'showcase/runtime'; LORE=RUNTIME/'lore'; BIN=ROOT/'.local/bin/openlore'
PRINCIPALS={'frontend-bot':'frontend','backend-bot':'backend','research-bot':'research','claude-frontend':'frontend','codex-backend':'backend','maintainer':'maintainer'}
URL='http://localhost:48080'
def command(args,**kwargs): return subprocess.run(args,check=True,text=True,capture_output=True,**kwargs)
def setup():
 RUNTIME.mkdir(parents=True,exist_ok=True);os.chmod(RUNTIME,0o700)
 if not BIN.exists():
  archive='openlore_'+('darwin' if platform.system()=='Darwin' else 'linux')+'_'+('arm64' if platform.machine() in ['arm64','aarch64'] else 'amd64')+'.tar.gz'
  downloads=ROOT/'.local/downloads';downloads.mkdir(parents=True,exist_ok=True);BIN.parent.mkdir(parents=True,exist_ok=True)
  base='https://github.com/aakarim/OpenLore/releases/download/v0.7.5/'
  for file in [archive,'checksums.txt']:command(['curl','-fsSL',base+file,'-o',str(downloads/file)])
  expected=next(line.split()[0] for line in (downloads/'checksums.txt').read_text().splitlines() if line.endswith(archive))
  assert hashlib.sha256((downloads/archive).read_bytes()).hexdigest()==expected,'Release checksum mismatch'
  command(['tar','-xzf',str(downloads/archive),'-C',str(BIN.parent)])
 assert command([str(BIN),'version']).stdout.strip()=='openlore 0.7.5','Showcase requires v0.7.5'
 LORE.mkdir(exist_ok=True)
 if not (LORE/'documents').exists():shutil.copytree(ROOT/'showcase/knowledge',LORE/'documents')
 credentials=RUNTIME/'credentials';credentials.mkdir(exist_ok=True);os.chmod(credentials,0o700)
 identities=[]
 for principal,role in PRINCIPALS.items():
  key=credentials/principal
  if not key.exists():command(['ssh-keygen','-q','-t','ed25519','-N','','-C',principal,'-f',str(key)])
  identities.append({'name':principal,'roles':[role],'public_key':key.with_suffix('.pub').read_text().strip()})
 policy=json.loads((ROOT/'showcase/lore.example.json').read_text())
 policy['identities']=identities
 (LORE/'lore.json').write_text(json.dumps(policy,indent=2)+'\n')
 (LORE/'openlore.yml').write_text((ROOT/'showcase/openlore.yml').read_text())
 for principal in PRINCIPALS:
  result=command([str(BIN),'token','mint','--identity',principal,'--ttl','24h'],cwd=LORE)
  token=credentials/(principal+'.token');token.write_text(result.stdout.strip());os.chmod(token,0o600)
 config=RUNTIME/'claude-frontend.mcp.json'
 config.write_text(json.dumps({'mcpServers':{'openlore':{'type':'http','url':URL+'/mcp','headers':{'Authorization':'Bearer '+(credentials/'claude-frontend.token').read_text()}}}},indent=2));os.chmod(config,0o600)
 print('OpenLore v0.7.5 configured. Six isolated identities; credentials remain in ignored runtime storage.')
def start():
 if not (LORE/'openlore.yml').exists():setup()
 try:
  r=urllib.request.urlopen(URL+'/api/shell',timeout=1)
  raise SystemExit('Port 48080 is occupied; use the existing managed server or stop it first.')
 except urllib.error.HTTPError:raise SystemExit('An OpenLore service is already listening on port 48080.')
 except urllib.error.URLError:pass
 logs=ROOT/'showcase/evidence';logs.mkdir(exist_ok=True)
 with (logs/'openlore-server.log').open('a') as out:
  p=subprocess.Popen([str(BIN),'--metrics-port','0','./documents'],cwd=LORE,stdout=out,stderr=out,start_new_session=True)
 (RUNTIME/'openlore.pid').write_text(str(p.pid))
 for _ in range(50):
  if p.poll() is not None:raise SystemExit('OpenLore failed; inspect showcase/evidence/openlore-server.log')
  try:
   urllib.request.urlopen(URL,timeout=1);print('OpenLore ready at '+URL);return
  except Exception:time.sleep(.2)
 raise SystemExit('OpenLore startup timed out')
def stop():
 p=RUNTIME/'openlore.pid'
 if p.exists():
  pid=int(p.read_text());args=command(['ps','-p',str(pid),'-o','command=']).stdout
  if str(BIN) not in args:raise SystemExit('PID no longer belongs to this showcase; refusing to stop it.')
  os.kill(pid,signal.SIGTERM)
  # OpenLore may drain history/analytics for up to 25 seconds while SSH remains bound.
  # Keep the ownership record until the process has really exited before restarting.
  deadline=time.monotonic()+40
  while time.monotonic()<deadline:
   state=subprocess.run(['ps','-p',str(pid),'-o','stat='],text=True,capture_output=True)
   if state.returncode!=0 or state.stdout.strip().startswith('Z'):break
   time.sleep(.25)
  else:raise SystemExit('Owned OpenLore process has not finished shutdown; refusing an overlapping restart.')
  p.unlink();print('Stopped showcase OpenLore after waiting for process exit.')
def candidate():
 token=(RUNTIME/'credentials/maintainer.token').read_text()
 req=urllib.request.Request(URL+'/api/shell',data=json.dumps({'command':'cat /contributions/inbox/api-contract-v2.md'}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 result=json.load(urllib.request.urlopen(req));assert result['exit_code']==0,'Publish the research contribution first.'
 return result['stdout']
def review():
 print(candidate())
def promote():
 # Explicit operator action. Agents have no maintainer connection or credential.
 text=candidate()
 assert all(s in text for s in ['POST /api/subscriptions/upgrade','idempotencyKey','"contractVersion": "v2"','Your Pro plan is active']), 'Candidate is not the expected demo contract.'
 assert 'PRIVATE_BACKEND_CANARY' not in text,'Private fixture content cannot be promoted.'
 token=(RUNTIME/'credentials/maintainer.token').read_text()
 import shlex
 req=urllib.request.Request(URL+'/api/shell',data=json.dumps({'command':'printf %s '+shlex.quote(text)+' > /shared/api-contract.md'}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 result=json.load(urllib.request.urlopen(req));assert result['exit_code']==0,result
 record={'action':'maintainer promotion','source':'/contributions/inbox/api-contract-v2.md','target':'/shared/api-contract.md','principal':'maintainer','sha256':hashlib.sha256(text.encode()).hexdigest(),'exit_code':result['exit_code']}
 (ROOT/'showcase/evidence/maintainer-promotion.json').write_text(json.dumps(record,indent=2)+'\n')
 print('Promoted the reviewed contribution as contract v2 through the maintainer identity.')
def reset_contract():
 # Explicit operator action for replay; normal setup never resets knowledge.
 import shlex
 text=(ROOT/'showcase/fixtures/api-contract-v1.md').read_text()
 token=(RUNTIME/'credentials/maintainer.token').read_text()
 req=urllib.request.Request(URL+'/api/shell',data=json.dumps({'command':'printf %s '+shlex.quote(text)+' > /shared/api-contract.md'}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 result=json.load(urllib.request.urlopen(req));assert result['exit_code']==0,result
 print('Contract reset to v1 for replay. Ask both coding clients to reconcile before using the SaaS demo. Existing chats and evidence were preserved.')
if __name__=='__main__':
 actions={'setup':setup,'start':start,'stop':stop,'promote':promote,'review':review,'reset-contract':reset_contract}
 actions[sys.argv[1] if len(sys.argv)>1 else 'setup']()
