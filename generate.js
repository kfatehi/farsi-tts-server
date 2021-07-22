const fs = require('fs');
const spawn = require('child_process').spawn;
const processWindows = require("node-process-windows");

async function focusWindow(processName) { // MiniSpeech
    return new Promise(async (resolve, reject)=> {
        processWindows.getProcesses(async function(err, processes) {
            var ttsProcess = processes.filter(p => p.processName.indexOf(processName) >= 0);
            if(ttsProcess.length > 0) {
                processWindows.focusWindow(ttsProcess[0]);
                let ttsFocused = null;
                while (!ttsFocused) {
                    ttsFocused = await isActiveWindow(processName);
                }
                resolve();
            }
        });
    })
}

async function isActiveWindow(processName) { // MiniSpeech
    return new Promise((resolve, reject)=> {
        processWindows.getActiveWindow((err, processInfo) => {
            resolve(processInfo.ProcessName == processName)
        });
    })
}


module.exports = ()=>{
    let ps = spawn("powershell.exe");
    ps.stdin.write(`Add-Type -Path PSCore.dll\n`);
    ps.stdin.write(`$Recording = [PSCore.LoopbackRecorder]\n`);
    return async (farsi, aac) => {
        return new Promise(async (resolve, reject) => {
            fs.writeFileSync("mytext.txt", "\n\n"+farsi+"\n\n");
            let recTimeMs = farsi.length * 180;
            // ps.stdout.on('data', (data)=>{
            //     process.stdout.write(data);
            // });
            ps.stderr.on('data', (data)=>{
                process.stderr.write(data);
            });
            await focusWindow("MiniSpeech");
            console.log("aac", aac);
            ps.stdin.write(`$Recording::StartRecording("${aac}")\n`);
            ps.stdin.write(`$wshell = New-Object -ComObject wscript.shell\n`);
            ps.stdin.write(`$wshell.SendKeys('{ESC}{ESC}{ESC}%{t}c%{t}c%{t}c%{a}{BS}%{f}omytext.txt{ENTER}%{ENTER}')\n`);
            setTimeout(()=>{
                // i need PSCore to be able to measure audio levels......
                // StartRecording should wait for audio and upon hearing some start a debouncer
                // that debouncer should, when silent for > 1 second, then StopRecording and resolve
                console.log("STOPPING RECORDING AFTER "+recTimeMs+" MILLISECONDS!");
                ps.stdin.write(`$Recording::StopRecording()\n`);
                resolve(aac);
            }, recTimeMs)
        });
    }
}