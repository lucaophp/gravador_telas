const $ = require('jquery');
const { desktopCapturer, remote } = require('electron');
const { dialog ,Menu } = remote;
var win = remote.getCurrentWindow();
function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}

$('#minimize').click(function(){
  win.minimize();
});

$('#close').click(function(){
  win.close();
});

$('#maximize').click(function() {
  if(win.isMaximized()){
      win.unmaximize();
  }else{
      win.maximize();
  }
  console.log(win.isMaximized());
});

//Buttons
const videoElement = document.querySelector('video');
// Global state
let mediaRecorder; // MediaRecorder instance to capture footage
let voiceStream;
const recordedChunks = [];
const startBtn = document.getElementById('startBtn');
const withAudio = document.getElementById('with-audio');
const stopBtn = document.getElementById('stopBtn');
const videoSelectBtn = document.getElementById('videoSelectBtn');
const withMic = document.getElementById('with-mic');
const captureBtn = document.getElementById('captureBtn');
captureBtn.disabled = true;
startBtn.disabled = true;
stopBtn.disabled = true;
videoElement.style.display = 'none';
captureBtn.onclick = e => {
    handleCapture(e);
};
startBtn.onclick = e => {
  mediaRecorder.start();
  startBtn.classList.add('is-danger');
  startBtn.innerText = 'Recording';
  withMic.disabled = true;
  withAudio.disabled = true;
};


stopBtn.onclick = e => {
  mediaRecorder.stop();
  startBtn.classList.remove('is-danger');
  startBtn.innerText = 'Começar';
  withMic.disabled = false;
  withAudio.disabled = false;
};

let sourceSel = null;
videoSelectBtn.onclick = getVideoSources;
withAudio.onchange = (ev) => {
    if (sourceSel === null) return
    selectSource(sourceSel)
}

withMic.onchange = (ev) => {
    if (sourceSel === null) return
    selectSource(sourceSel)
}
const mergeAudioStreams = (desktopStream, voiceStream) => {
    const context = new AudioContext();
      
    // Create a couple of sources
    const source1 = context.createMediaStreamSource(desktopStream);
    const source2 = context.createMediaStreamSource(voiceStream);
    const destination = context.createMediaStreamDestination();
    
    const desktopGain = context.createGain();
    const voiceGain = context.createGain();
      
    desktopGain.gain.value = 0.7;
    voiceGain.gain.value = 0.7;
     
    source1.connect(desktopGain).connect(destination);
    // Connect source2
    source2.connect(voiceGain).connect(destination);
      
    return destination.stream.getAudioTracks();
};
// pegar todas as fontes de video;
async function getVideoSources() {
    const inputSources = await desktopCapturer.getSources({
        types: ['window', 'screen']
    });
    const videoOptionsMenu = Menu.buildFromTemplate(
        inputSources.map(source => {
            return {
                label: source.name,
                click: () => selectSource(source)
            }
        })
    );
    videoOptionsMenu.popup();

}
async function selectSource(source) {
    sourceSel = source
    const mic = withMic.checked || false;
    videoElement.style.display = 'block';
    startBtn.disabled = false;
    stopBtn.disabled = false;
    captureBtn.disabled = false;
    console.log(withAudio.checked);
    videoSelectBtn.innerText = source.name;
    const constraints = {
        audio: withAudio.checked ? {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
            }
        } : false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
            }
        }
    };
    // create stream
    const desktopStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (mic === true) {
        voiceStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: mic });
    }

    const tracks = (mic === true) ? [
        ...desktopStream.getVideoTracks(), 
        ...mergeAudioStreams(desktopStream, voiceStream)
    ] : desktopStream;
    const stream = new MediaStream(tracks);
    videoElement.srcObject = stream;
    videoElement.play();
    
    // create the media recorder;
    const options = { mimeType: 'video/webm;codecs=vp9'};
    mediaRecorder = new MediaRecorder(stream, options);
    setTimeout(() => {
        // events;
        mediaRecorder.ondataavailable = handleDataAvailable;
        mediaRecorder.onstop = handleStop;
    }, 100);
    
}
const { writeFile, writeFileSync } = require('fs');
async function handleCapture(e) {
    var canvas = document.createElement("canvas");
    var scale = 1;
        canvas.width = videoElement.videoWidth * scale;
        canvas.height = videoElement.videoHeight * scale;
        canvas.getContext('2d')
              .drawImage(videoElement, 0, 0, canvas.width, canvas.height);
 
        var img = document.createElement("img");
        img.src = canvas.toDataURL();
        let cap = Buffer.from( await dataURLtoBlob(canvas.toDataURL()).arrayBuffer() );
        // let cap = dataURLtoBlob(canvas.toDataURL());
        // document.getElementById('app').prepend(img);
        console.log(cap);
    // Call our method to save the data url to an image.
    setTimeout(async () => {
        const { filePath } = await dialog.showSaveDialog({
            buttonLabel: 'Save capture',
            defaultPath: `cap-${Date.now()}.png`
        });
        writeFileSync(filePath, cap)
    }, 100)
}
async function handleDataAvailable(e) {
    recordedChunks.push(e.data);
}
async function handleStop(e) {
    const blob = new Blob(recordedChunks, {
        type: 'video/webm;codecs=vp9'
    });
    const buffer = Buffer.from( await blob.arrayBuffer() );
    const { filePath } = await dialog.showSaveDialog({
        buttonLabel: 'Save video',
        defaultPath: `vid-${Date.now()}.webm`
    });
    
    while (recordedChunks.length > 0) {
        recordedChunks.pop()
    }
    if (filePath) {
        writeFileSync(filePath, buffer)
    }
}
