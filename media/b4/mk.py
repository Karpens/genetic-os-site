import subprocess, sys, os, re, json, asyncio, requests
try:
    import edge_tts, imageio_ffmpeg
except ImportError:
    subprocess.run([sys.executable,"-m","pip","install","-q","edge-tts","imageio-ffmpeg"],capture_output=True); import edge_tts, imageio_ffmpeg
ff=imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs("/mnt/files/tts",exist_ok=True); os.makedirs("/mnt/files/b4",exist_ok=True)
RAW="https://raw.githubusercontent.com/Karpens/genetic-os-site/claude/exciting-hypatia-b2fgru/media/b4/"
def adur(fn):
    p=subprocess.run([ff,"-i",fn,"-f","null","-"],capture_output=True,text=True)
    d=re.findall(r"time=(\d+):(\d+):([\d.]+)",p.stderr)[-1]; return round(int(d[0])*3600+int(d[1])*60+float(d[2]),2)
async def _one(slug,i,t):
    fn=f"/mnt/files/tts/{slug}_{i:02d}.mp3"
    if os.path.exists(fn) and os.path.getsize(fn)>1000: return
    c=edge_tts.Communicate(t,"en-GB-RyanNeural",rate="+4%")
    with open(fn+".part","wb") as f:
        async for ch in c.stream():
            if ch["type"]=="audio": f.write(ch["data"])
    os.replace(fn+".part",fn)
async def tts_all(slug,lines): await asyncio.gather(*[_one(slug,i,t) for i,t in enumerate(lines)])
def mux(slug,dur,starts):
    vis=f"/mnt/files/b4/{slug}_visual.mp4"
    if not os.path.exists(vis):
        r=requests.get(RAW+f"{slug}-visual.mp4",timeout=120); r.raise_for_status(); open(vis,"wb").write(r.content)
    n=len(starts); inputs=["-i",vis]
    for i in range(n): inputs+=["-i",f"/mnt/files/tts/{slug}_{i:02d}.mp3"]
    fc=[f"[{i+1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(s*1000)}|{int(s*1000)}[v{i}]" for i,s in enumerate(starts)]
    fc.append("".join(f"[v{i}]" for i in range(n))+f"amix=inputs={n}:normalize=0:dropout_transition=0[voice]")
    fc+=["[voice]asplit=2[vo][sc]","[0:a]aresample=48000,volume=1.6[bed]","[bed][sc]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[bedd]",
         "[vo][bedd]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.0:LRA=11,aresample=48000,apad[aout]"]
    out=f"/mnt/files/b4/{slug}_final.mp4"
    p=subprocess.run([ff,"-y","-loglevel","error"]+inputs+["-filter_complex",";".join(fc),"-map","0:v","-map","[aout]","-c:v","copy","-c:a","aac","-b:a","192k","-t",str(dur),"-movflags","+faststart",out],capture_output=True,text=True,timeout=150)
    return p.returncode,p.stderr[-200:],os.path.getsize(out) if os.path.exists(out) else None
J=requests.get(RAW+"J_all.json",timeout=30).json()
