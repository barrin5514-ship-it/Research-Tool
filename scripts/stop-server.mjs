const port=Number(process.env.RESEARCH_PORT||5199);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid RESEARCH_PORT');
const origin=`http://127.0.0.1:${port}`;
try{
  const response=await fetch(origin+'/api/state',{redirect:'error',signal:AbortSignal.timeout(3000)});
  const state=await response.json();
  if(state.application!=='instagram-research-library'||typeof state.csrf!=='string')throw Error('This port is not the Research Library');
  const stopped=await fetch(origin+'/api/shutdown',{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{origin,'content-type':'application/json','x-research-token':state.csrf},body:'{}'});
  if(!stopped.ok)throw Error('The dashboard could not be stopped through its local endpoint');
  console.log('Research Library is stopping. Interrupted videos will be pending on the next launch.');
}catch(error){console.error(error.message);process.exitCode=1;}
