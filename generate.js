const fs = require('fs');
const spawn = require('child_process').spawn;
const processWindows = require("node-process-windows");

async function focusWindow(processName) { // MiniSpeech
    return new Promise(async (resolve, reject) => {
        processWindows.getProcesses(async function (err, processes) {
            var ttsProcess = processes.filter(p => p.processName.indexOf(processName) >= 0);
            if (ttsProcess.length > 0) {
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
    return new Promise((resolve, reject) => {
        processWindows.getActiveWindow((err, processInfo) => {
            resolve(processInfo.ProcessName == processName)
        });
    })
}


module.exports = () => {
    return async (farsi, aac) => {
        return new Promise(async (resolve, reject) => {
            fs.writeFileSync("mytext.txt", "\n\n" + farsi + "\n\n");
            startRecording(aac, (ps)=>{
                ps.stdin.write(`$wshell = New-Object -ComObject wscript.shell\n`);
                await focusWindow("MiniSpeech");
                ps.stdin.write(`$wshell.SendKeys('{ESC}{ESC}{ESC}%{t}c%{t}c%{t}c%{a}{BS}%{f}omytext.txt{ENTER}%{ENTER}')\n`);    
            })
        });
    }
}


const split2 = require('split2');


async function startRecording(filepath, wantsPowershellInput=function(psin){}) {
    return new Promise(async (resolve, reject) => {

        let recordedNonSilenceYet = false;
        const silentStopTimeout = 1500;
        const ZEROSIGNAL = 0.0001;
        let timeOfLastNonSilentLevel;

        const createSilenceAnalyzer = (cb) => (level) => {
            // Have we recorded anything yet?
            if (recordedNonSilenceYet == false) {
                // No we haven't. So we're going to be patient until we do.
                // If level is > 0, then yeah, we have.
                if (level > ZEROSIGNAL)
                    recordedNonSilenceYet = true;
            } else {
                // Yes, we must have.
                // Is it silent now?
                if (level <= ZEROSIGNAL) {
                    // How long have we been silent ?
                    let elapsedTicks = Date.now() - timeOfLastNonSilentLevel;
                    if (elapsedTicks >= silentStopTimeout) {
                        // That's long enough. Stop Recording.
                        cb();
                    }
                }
            }
            if (level > ZEROSIGNAL) {
                timeOfLastNonSilentLevel = Date.now();
            }
        }

        let ps = spawn("powershell.exe");
        ps.on('exit', (code) => {
            console.log("Exited");
            resolve(filepath);
        });
        const silenceBreaker = createSilenceAnalyzer(() => {
            ps.stdin.write(`$Recording::StopRecording()\n`);
            ps.stdin.end();
        });
        ps.stdout.pipe(split2()).on('data', (line) => {
            str = line.toString();
            let match = str.match(/^peak:(.+)$/);
            if (match) {
                const level = parseFloat(match[1]);
                silenceBreaker(level);
            } else {
                process.stdout.write("o>" + str + '\n');
            }
        });
        ps.stderr.on('data', (data) => {
            process.stderr.write("e>" + data.toString());
        });
        ps.stdin.write(`Add-Type -Path PSCore.dll\n`);
        ps.stdin.write(`$Recording = [PSCore.LoopbackRecorder]\n`);
        ps.stdin.write(`$Recording::StartRecording("${filepath}")\n`);
        if (extraPowershellCommander) {
            extraPowershellCommander(ps.stdin);
        }
    });
}

if (!module.parent) {
    startRecording("C:\\workspace\\farsi-tts-server\\test.aac");
}