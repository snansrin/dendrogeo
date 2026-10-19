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
  const chromium=(await import('playwright-core')).chromium;
  // CI and developer machines may already have a managed system browser.
  // Use it only when explicitly configured; Playwright's pinned browser stays
  // the default everywhere else.
  const executablePath=process.env.DENDROGEO_CHROMIUM_EXECUTABLE;
  if(executablePath){
    const launch=chromium.launch.bind(chromium);
    chromium.launch=(options={})=>launch({...options,executablePath:options.executablePath||executablePath});
  }
  return chromium;
}
