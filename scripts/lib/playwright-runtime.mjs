import {existsSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(fileURLToPath(new URL('../..',import.meta.url)));
const localBrowsers=join(root,'work','.playwright');
const browserFiles=process.platform==='win32'?['chrome-win64/chrome.exe','chrome-win/chrome.exe']:process.platform==='darwin'?['chrome-mac/Chromium.app/Contents/MacOS/Chromium']:['chrome-linux64/chrome','chrome-linux/chrome'];

export async function loadChromium(){
  if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync(localBrowsers)){
    const builds=readdirSync(localBrowsers).filter(name=>name.startsWith('chromium-')).sort().reverse();
    if(builds.some(build=>browserFiles.some(file=>existsSync(join(localBrowsers,build,file)))))process.env.PLAYWRIGHT_BROWSERS_PATH=localBrowsers;
  }
  return(await import('playwright-core')).chromium;
}
