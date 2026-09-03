"""멍냥아레나 AAB를 Google Play 트랙에 올린다 (Android Publisher API v3, 서비스계정).
사용: python tools/play_upload.py [--track production|internal] [--dry-run]
  --dry-run: 업로드+검증까지만 하고 edit을 삭제(아무것도 게시되지 않음).
listing/이미지는 건드리지 않는다.
"""
import argparse, sys, time
from pathlib import Path
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parent.parent
KEY = r"C:\Users\swsz9\Downloads\dev-fusion-493007-v1-bd41ccc10833.json"
PKG = "com.petaflo.pawpawarena"
AAB = ROOT / "android" / "app" / "build" / "outputs" / "bundle" / "release" / "app-release.aab"
NOTES = {
  "ko-KR": "v1.1.0: 한/영 UI, 프리미엄 동물 결제 안정화(RevenueCat), 온라인 방 개선.",
  "en-US": "v1.1.0: Korean/English UI, more reliable premium unlock (RevenueCat), online room improvements.",
}
ap = argparse.ArgumentParser(); ap.add_argument("--track", default="production"); ap.add_argument("--dry-run", action="store_true")
a = ap.parse_args()
creds = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/androidpublisher"])
svc = build("androidpublisher", "v3", credentials=creds, cache_discovery=False); edits = svc.edits()
eid = None
for i in range(5):
    try: eid = edits.insert(packageName=PKG, body={}).execute()["id"]; break
    except HttpError as ex: print("insert retry", i+1, ex.status_code, flush=True); time.sleep(20)
print("1) edit", eid[:12], flush=True)
print(f"2) upload {AAB.name} ({AAB.stat().st_size/1048576:.1f} MB)", flush=True)
b = edits.bundles().upload(packageName=PKG, editId=eid, media_body=MediaFileUpload(str(AAB), mimetype="application/octet-stream", resumable=True)).execute()
vc = b["versionCode"]; print("   versionCode", vc, flush=True)
edits.tracks().update(packageName=PKG, editId=eid, track=a.track, body={"releases": [{"status": "completed", "versionCodes": [str(vc)], "releaseNotes": [{"language": k, "text": v} for k, v in NOTES.items()]}]}).execute()
print(f"3) track {a.track} <- {vc}", flush=True)
try:
    edits.validate(packageName=PKG, editId=eid).execute(); print("4) validate OK", flush=True)
except HttpError as ex:
    print("4) VALIDATE ERROR:", ex.status_code, str(ex)[:600], flush=True); edits.delete(packageName=PKG, editId=eid).execute(); sys.exit(2)
if a.dry_run:
    edits.delete(packageName=PKG, editId=eid).execute(); print("dry-run: edit deleted, nothing published", flush=True); sys.exit(0)
try:
    edits.commit(packageName=PKG, editId=eid).execute(); print(f"5) COMMIT OK: versionCode {vc} -> {a.track}", flush=True)
except HttpError as ex:
    print("5) COMMIT ERROR:", ex.status_code, str(ex)[:800], flush=True); sys.exit(3)
