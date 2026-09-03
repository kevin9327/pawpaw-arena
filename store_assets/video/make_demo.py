"""데모 영상 최종 컷: 타이틀 카드(3s) + 게임플레이 클립 + 아웃트로(4s) + 자막 오버레이. 2분 미만 보장.
사용: python make_demo.py <clip.mp4> [clip_seconds]
"""
import sys, os, subprocess, re
sys.stdout.reconfigure(encoding='utf-8')
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
D = os.path.dirname(os.path.abspath(__file__))
clip = sys.argv[1]
clip_len = float(sys.argv[2]) if len(sys.argv) > 2 else 66.0
TITLE, OUTRO = 3.0, 4.0
# 자막 타이밍(클립 기준 초) → 전체 타임라인 = +TITLE
caps = [(0, 1.5, 7.5), (1, 9, 16), (2, 20, 28), (3, 34, 41), (4, 50, 60)]
inputs = ['-loop', '1', '-t', str(TITLE), '-i', f'{D}/card_title.png',
          '-i', clip,
          '-loop', '1', '-t', str(OUTRO), '-i', f'{D}/card_outro.png']
for i, _, _ in caps:
    inputs += ['-i', f'{D}/cap_{i}.png']
fc = []
fc.append(f'[0:v]fps=30,format=yuv420p,fade=t=out:st={TITLE-0.5}:d=0.5[t]')
fc.append(f'[1:v]trim=0:{clip_len},setpts=PTS-STARTPTS,fps=30,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st={clip_len-0.5}:d=0.5[c0]')
prev = 'c0'
for n, (i, a, b) in enumerate(caps):
    fc.append(f"[{prev}][{3+n}:v]overlay=0:0:enable='between(t,{a},{b})'[c{n+1}]")
    prev = f'c{n+1}'
fc.append(f'[2:v]fps=30,format=yuv420p,fade=t=in:st=0:d=0.4[o]')
fc.append(f'[t][{prev}][o]concat=n=3:v=1:a=0[v]')
out = f'{D}/pawpaw_demo_final_1080x1920.mp4'
cmd = [FF, '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-1500:]); sys.exit(1)
info = subprocess.run([FF, '-i', out], capture_output=True, text=True).stderr
dur = re.search(r'Duration: (\d+:\d+:\d+\.\d+)', info)
print('final:', out, os.path.getsize(out), 'bytes | duration', dur.group(1) if dur else '?')
