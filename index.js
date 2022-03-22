
const sizeControl = document.getElementById("sizeslider");
const sizeDisplay = document.getElementById("sizedisplay");
const fileInput = document.getElementById("fileinput");
const loadingIndicator = document.getElementById("loadingindicator");
const mainDiv = document.getElementById("main");

let target_size = 8000 // kilobytes
let audioCtx;

sizeControl.oninput = e => {
    sizeDisplay.innerText = `${e.target.value}mb`;
    target_size = e.target.value * 1000;
}

fileInput.onchange = () => {
    loadAudioFile(fileInput.files)
}


const initAudioCtx = () => {
    audioCtx = new AudioContext();
}

const f32audioToInt16 = data => {
    let len = data.length;
    let i = 0;
    let dataAsInt16Array = new Int16Array(len);

    const convert = n => {
        let v = n < 0 ? n * 32768 : n * 32767;       // convert in range [-32768, 32767]
        return Math.max(-32768, Math.min(32768, v)); // clamp
    }

    while(i < len) dataAsInt16Array[i] = convert(data[i++]);

    return dataAsInt16Array;
}


const loadAudioFile = fileList => {
    if (!fileList.length === 1) return;
    
    console.log(fileList);
    
    if(!audioCtx){
        initAudioCtx();
    }

    loadingIndicator.hidden = false;
    document.querySelectorAll('.savebtn').forEach(e => e.parentNode.removeChild(e));

    let f = fileList[0];
    f.arrayBuffer().then(res => {
        audioCtx.decodeAudioData(res).then(audioBuffer => {
            console.log(audioBuffer);
            
            // bitrate is calculated so that the target file size is achieved
            // multiply by 8 to get bits from bytes, multiply by 0.9 for a margin of error
            let calculated_kbps = Math.floor(8 * (0.9 * target_size) / audioBuffer.duration);
            let kbps = Math.min(320, calculated_kbps);

            console.log(kbps, calculated_kbps);

            let mp3encoder = new lamejs.Mp3Encoder(
                audioBuffer.numberOfChannels,
                audioBuffer.sampleRate,
                kbps
            );

            let mp3Data = [];

            if (audioBuffer.numberOfChannels == 2){
                let left = f32audioToInt16(audioBuffer.getChannelData(0)); 
                let right = f32audioToInt16(audioBuffer.getChannelData(1));
    
                let sampleBlockSize = 1152; //can be anything but make it a multiple of 576 to make encoders life easier

                for (let i = 0; i < left.length; i += sampleBlockSize) {
                    let leftChunk = left.subarray(i, i + sampleBlockSize);
                    let rightChunk = right.subarray(i, i + sampleBlockSize);
                    let mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }
            }
            else if (audioBuffer.numberOfChannels == 1){
                let samples = f32audioToInt16(audioBuffer.getChannelData(0));

                let sampleBlockSize = 1152; // can be anything but make it a multiple of 576 to make encoders life easier

                let mp3Data = [];
                for (let i = 0; i < samples.length; i += sampleBlockSize) {
                    sampleChunk = samples.subarray(i, i + sampleBlockSize);
                    let mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(mp3buf);
                    }
                }
            }
            else{
                alert("No support for >2 channels");
                return;
            }

            let mp3buf = mp3encoder.flush(); // finish writing mp3

            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }

            let blob = new Blob(mp3Data, {type: 'audio/mp3'});
            let url = URL.createObjectURL(blob);
            console.log('MP3 URl: ', url);

            loadingIndicator.hidden = true;

            const save_link = document.createElement('a');
            save_link.href = url;
            save_link.download = "compressed.mp3";
            save_link.innerText = "Save";
            save_link.className = "savebtn";
            mainDiv.appendChild(save_link);
        })
    })
}