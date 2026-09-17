const state={step:1,glasses:null,face:null,landmarks:null,fit:{scale:1,y:0},stream:null};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const el={glassesInput:$('#glassesInput'),faceInput:$('#faceInput'),glassesPreview:$('#glassesPreview'),facePreview:$('#facePreview'),result:$('#resultCanvas'),work:$('#workCanvas'),camera:$('#camera'),toast:$('#toast')};

function toast(message){el.toast.textContent=message;el.toast.classList.add('show');setTimeout(()=>el.toast.classList.remove('show'),2600)}
function go(step){if(step===2&&!state.glasses)return toast('Add a glasses image first.');if(step===3&&!state.face)return toast('Add your photo first.');state.step=step;$$('.panel').forEach(p=>p.classList.toggle('active',+p.dataset.panel===step));$$('.step').forEach((s,i)=>{s.classList.toggle('active',i+1===step);s.classList.toggle('done',i+1<step)});$$('.step-line').forEach((l,i)=>l.classList.toggle('done',i+1<step));scrollTo({top:0,behavior:'smooth'})}
function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image;i.onload=()=>resolve(i);i.onerror=reject;i.src=src})}
function fileURL(file){return new Promise((resolve,reject)=>{const r=new FileReader;r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}

async function removeBackground(file){
  const original=await fileURL(file);toast('Removing the background…');
  try{
    const aiTask=(async()=>{const {removeBackground}=await import('https://esm.sh/@imgly/background-removal@1.7.0');return removeBackground(file,{progress:(key,current,total)=>{if(key.includes('compute')&&total)$('#glassesStatus').textContent=`◌ Processing ${Math.round(current/total*100)}%`}})})();
    const blob=await Promise.race([aiTask,new Promise((_,reject)=>setTimeout(()=>reject(new Error('AI model timed out')),15000))]);
    return URL.createObjectURL(blob);
  }catch(error){console.warn('AI background removal unavailable; using local edge-color fallback.',error);return fallbackBackgroundRemoval(original)}
}

async function fallbackBackgroundRemoval(src){
  const img=await loadImage(src),c=el.work,x=c.getContext('2d',{willReadFrequently:true}),maxSide=1600,ratio=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*ratio));c.height=Math.max(1,Math.round(img.naturalHeight*ratio));x.drawImage(img,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height),p=d.data;
  const corners=[[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]];let bg=[0,0,0];corners.forEach(([cx,cy])=>{const k=(cy*c.width+cx)*4;bg[0]+=p[k]/4;bg[1]+=p[k+1]/4;bg[2]+=p[k+2]/4});
  for(let i=0;i<p.length;i+=4){const dist=Math.hypot(p[i]-bg[0],p[i+1]-bg[1],p[i+2]-bg[2]);p[i+3]=dist<35?0:dist<85?Math.round((dist-35)/50*255):255}x.putImageData(d,0,0);toast('Used the built-in background remover.');return c.toDataURL('image/png')
}

async function setGlasses(file){
  if(!file)return;
  if(!file.type.startsWith('image/'))return toast('Please choose a PNG, JPG, or WebP image.');
  if(file.size>20*1024*1024)return toast('Please choose an image smaller than 20 MB.');
  $('#toStep2').disabled=true;$('#glassesFileName').textContent=file.name;$('#glassesStatus').textContent='◌ Removing background…';$('#glassesMessage').textContent='Keep this page open while the browser prepares your frame.';
  try{
    const original=await fileURL(file);el.glassesPreview.src=original;$('#glassesDrop').classList.add('hidden');$('#glassesPreviewCard').classList.remove('hidden');
    const processed=await removeBackground(file);state.glasses=await loadImage(processed);el.glassesPreview.src=processed;$('#glassesStatus').textContent='✓ Background removed';$('#glassesMessage').textContent='The transparent frame is ready for fitting.';$('#toStep2').disabled=false;toast('Frame is ready.');
  }catch(e){console.error(e);$('#glassesStatus').textContent='Processing failed';$('#glassesMessage').textContent='Try a smaller JPG or PNG image with a plain background.';toast('That image could not be processed. Try another file.');}
}
async function setFace(source){try{state.face=await loadImage(source);el.facePreview.src=source;$('#facePreviewCard').classList.remove('hidden');$('.choice-grid').classList.add('hidden');$('#createTryOn').disabled=false;stopCamera();toast('Photo is ready.')}catch(e){toast('That photo could not be opened.')}}

async function detectLandmarks(){
  try{
    const vision=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm');
    const fileset=await vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm');
    const detector=await vision.FaceLandmarker.createFromOptions(fileset,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'GPU'},runningMode:'IMAGE',numFaces:1});
    const result=detector.detect(state.face);detector.close();return result.faceLandmarks?.[0]||null;
  }catch(e){console.warn('MediaPipe unavailable.',e);toast('Face AI unavailable — showing an adjustable center fit.');return null}
}

function draw(){
  const face=state.face,glasses=state.glasses,c=el.result,x=c.getContext('2d');const max=1400,ratio=Math.min(1,max/face.naturalWidth);c.width=Math.round(face.naturalWidth*ratio);c.height=Math.round(face.naturalHeight*ratio);x.drawImage(face,0,0,c.width,c.height);
  let cx=c.width*.5,cy=c.height*.43,width=c.width*.48,angle=0;
  if(state.landmarks){const L=state.landmarks[33],R=state.landmarks[263];cx=(L.x+R.x)/2*c.width;cy=(L.y+R.y)/2*c.height;width=Math.hypot((R.x-L.x)*c.width,(R.y-L.y)*c.height)*2.15;angle=Math.atan2((R.y-L.y)*c.height,(R.x-L.x)*c.width)}
  width*=state.fit.scale;const h=width*(glasses.naturalHeight/glasses.naturalWidth);cy+=state.fit.y*c.height/500;x.save();x.translate(cx,cy);x.rotate(angle);x.drawImage(glasses,-width/2,-h/2,width,h);x.restore();
}
async function createResult(){go(3);$('#processing').classList.remove('hidden');state.landmarks=await detectLandmarks();draw();$('#processing').classList.add('hidden')}

async function openCamera(){try{state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280}},audio:false});el.camera.srcObject=state.stream;$('#cameraWrap').classList.remove('hidden');$('.choice-grid').classList.add('hidden')}catch(e){toast('Camera access was unavailable. You can upload a photo instead.')}}
function stopCamera(){state.stream?.getTracks().forEach(t=>t.stop());state.stream=null;$('#cameraWrap').classList.add('hidden')}
function capture(){const c=el.work,x=c.getContext('2d');c.width=el.camera.videoWidth;c.height=el.camera.videoHeight;x.translate(c.width,0);x.scale(-1,1);x.drawImage(el.camera,0,0);setFace(c.toDataURL('image/jpeg',.92))}
function resetFace(){state.face=null;state.landmarks=null;$('#facePreviewCard').classList.add('hidden');$('.choice-grid').classList.remove('hidden');$('#createTryOn').disabled=true}
function resetAll(){stopCamera();state.glasses=state.face=state.landmarks=null;state.fit={scale:1,y:0};$('#glassesPreviewCard').classList.add('hidden');$('#glassesDrop').classList.remove('hidden');$('#toStep2').disabled=true;resetFace();el.glassesInput.value='';el.faceInput.value='';go(1)}

el.glassesInput.addEventListener('change',e=>setGlasses(e.target.files[0]));el.faceInput.addEventListener('change',async e=>{const f=e.target.files[0];if(f)setFace(await fileURL(f))});
const dz=$('#glassesDrop');['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>setGlasses(e.dataTransfer.files[0]));
$('#replaceGlasses').onclick=()=>el.glassesInput.click();$('#toStep2').onclick=()=>go(2);$('#openCamera').onclick=openCamera;$('#closeCamera').onclick=()=>{stopCamera();$('.choice-grid').classList.remove('hidden')};$('#capture').onclick=capture;$('#replaceFace').onclick=resetFace;$('#createTryOn').onclick=createResult;$('#startOver').onclick=resetAll;
$$('[data-back]').forEach(b=>b.onclick=()=>go(+b.dataset.back));$$('[data-go]').forEach(b=>b.onclick=()=>go(+b.dataset.go));
$('#scaleControl').oninput=e=>{state.fit.scale=e.target.value/100;draw()};$('#yControl').oninput=e=>{state.fit.y=+e.target.value;draw()};$('#resetFit').onclick=()=>{state.fit={scale:1,y:0};$('#scaleControl').value=100;$('#yControl').value=0;draw()};
$('#downloadResult').onclick=()=>{const a=document.createElement('a');a.download='frameflow-virtual-try-on.png';a.href=el.result.toDataURL('image/png');a.click()};window.addEventListener('beforeunload',stopCamera);
