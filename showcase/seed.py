#!/usr/bin/env python3
"""Seed the showcase through the real OpenCrewBot HTTP API. Re-running does not duplicate bots."""
from pathlib import Path
import json,urllib.request,urllib.error,os
ROOT=Path(__file__).resolve().parents[1];APP=os.environ.get('OPENCREWBOT_SHOWCASE_URL','http://localhost:3300');RUNTIME=ROOT/'showcase/runtime'
def api(path,data=None,method=None):
 req=urllib.request.Request(APP+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'},method=method)
 try:r=urllib.request.urlopen(req,timeout=120)
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
 return json.load(r)
def seed():
 manifest_path=RUNTIME/'manifest.json'
 if manifest_path.exists():
  manifest=json.loads(manifest_path.read_text());ids={b['id'] for b in api('/api/bootstrap')['bots']}
  if all(x in ids for x in manifest['bots'].values()):
   for principal, server in manifest['connections'].items():
    try: api('/api/connections/mcp/'+server+'/test',{},'POST')
    except RuntimeError: pass  # A previously verified token may have expired.
    api('/api/connections/mcp/'+server,{'token':(RUNTIME/'credentials'/(principal+'.token')).read_text()},'PATCH')
    checked=api('/api/connections/mcp/'+server+'/test',{},'POST');assert checked.get('identity')==principal,checked
   print('Existing showcase retained; credentials refreshed and identities verified.');return manifest
 manifest={'bots':{},'connections':{},'rooms':{}}
 tools={'memory':True,'webSearch':False,'codeMode':False,'browser':False,'askUser':True}
 for principal,name,role,color in [('backend-bot','Backend Engineer','Backend','#3683b8'),('frontend-bot','Frontend Engineer','Frontend','#cf8645'),('research-bot','Research Contributor','Research','#68976c')]:
  connection=api('/api/connections/mcp',{'kind':'openlore','name':'OpenLore · '+role,'url':'http://localhost:48080/mcp','token':(RUNTIME/'credentials'/(principal+'.token')).read_text()})['server']
  status=api('/api/connections/mcp/'+connection['id']+'/test',{},'POST');assert status['identity']==principal,status
  bot=api('/api/bots',{'name':name,'title':role+' · Team Memory','description':'Orbit subscription project. Scoped '+role.lower()+' knowledge through OpenLore.','instructions':'Consult OpenLore before answering project questions. Keep personal notes in MEMORY.md; save team decisions to your writable collection. Cite current source paths. Never copy private notes across team boundaries. Contributions are shared with all teams, so only submit material approved for that audience.','emoji':'','color':color,'model':'Qwen/Qwen3-235B-A22B-Instruct-2507','tools':tools,'connections':['mcp:'+connection['id']],'approval':'ask','pinned':True})['bot']
  manifest['bots'][principal]=bot['id'];manifest['connections'][principal]=connection['id']
  room=api('/api/rooms',{'name':role+' room','topic':'Orbit · '+role.lower()+' context boundary','emoji':'','memberIds':[bot['id']],'leadId':bot['id'],'responder':'lead','pinned':True})['room']
  manifest['rooms'][principal]=room['id']
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
 print('Seeded three scoped bots and three isolated rooms. Identity checks passed.');return manifest
if __name__=='__main__':seed()
