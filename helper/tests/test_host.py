import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import time
import unittest
import uuid
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from media import youtube_url,shape_video,safe_name,clean_error
from host import Host,read_message

class ValidationTests(unittest.TestCase):
    def test_canonical_link(self):
        self.assertEqual(youtube_url('https://youtu.be/aqz-KE-bpKQ?t=2'),'https://www.youtube.com/watch?v=aqz-KE-bpKQ')
    def test_invalid_links(self):
        for value in ['https://youtube.com.evil.test/watch?v=aqz-KE-bpKQ','https://u:p@youtube.com/watch?v=aqz-KE-bpKQ','https://youtube.com/playlist?list=x','javascript:alert(1)']:
            with self.assertRaises(ValueError): youtube_url(value)
    def test_format_pairing_excludes_silent_and_drm(self):
        data={'id':'aqz-KE-bpKQ','title':'Test','formats':[{'format_id':'137','ext':'mp4','height':1080,'vcodec':'avc1','acodec':'none','filesize':100},{'format_id':'140','ext':'m4a','vcodec':'none','acodec':'mp4a','abr':128,'filesize':20},{'format_id':'999','ext':'mp4','height':2160,'vcodec':'avc1','acodec':'mp4a','has_drm':True}]}
        public,selectors=shape_video(data)
        self.assertEqual(selectors,{'1080-mp4':'137+140'});self.assertEqual(public['formats'][0]['filesize'],120)
        self.assertNotIn('_selector',public['formats'][0])
    def test_silent_video_is_not_offered_as_complete(self):
        with self.assertRaisesRegex(ValueError,'No downloadable'):shape_video({'id':'aqz-KE-bpKQ','formats':[{'format_id':'137','ext':'mp4','height':1080,'vcodec':'avc1','acodec':'none'}]})
    def test_live_and_private_are_rejected(self):
        for value in [{'is_live':True},{'availability':'private'}]:
            with self.assertRaisesRegex(ValueError,'not supported|restricted access'):shape_video({'id':'aqz-KE-bpKQ',**value})
    def test_error_removes_signed_urls(self):
        self.assertNotIn('secret',clean_error('ERROR: blocked https://example.com/v?secret=yes'))
    def test_bot_check_explains_limitation(self):
        self.assertIn('does not import browser cookies',clean_error('Sign in to confirm you are not a bot. Use --cookies-from-browser'))
    def test_filename_is_safe(self):
        self.assertEqual(safe_name('CON'),'video_CON');self.assertNotIn('/',safe_name('../../bad'))
    def test_protocol_size_and_truncation(self):
        with self.assertRaises(ValueError):read_message(io.BytesIO(struct.pack('<I',100000)))
        with self.assertRaises(ValueError):read_message(io.BytesIO(struct.pack('<I',9)+b'{}'))
        encoded=json.dumps({'text':'नमस्ते'}).encode('utf-8')
        self.assertEqual(read_message(io.BytesIO(struct.pack('<I',len(encoded))+encoded))['text'],'नमस्ते')
    def test_restart_recovers_active_job(self):
        with tempfile.TemporaryDirectory() as temp:
            state=Path(temp)/'state';state.mkdir();(state/'jobs.json').write_text(json.dumps({'a':{'id':'a','status':'downloading','createdAt':1}}))
            h=Host(temp,output=Path(temp)/'downloads');self.assertEqual(h.jobs['a']['status'],'interrupted');h.close()
    def test_expired_inspection_and_untrusted_format(self):
        with tempfile.TemporaryDirectory() as temp:
            h=Host(temp,output=Path(temp)/'downloads')
            with self.assertRaises(ValueError):h.start_download({'id':'12345678-1234-1234-1234-123456789012','token':'missing','formatId':'137;cmd'})
            h.cache['valid']={'created':time.monotonic(),'selectors':{'1080-mp4':'137+140'}}
            with self.assertRaisesRegex(ValueError,'selected format'):h.start_download({'id':'12345678-1234-1234-1234-123456789012','token':'valid','formatId':'137;cmd'})
            h.close()
    def test_clear_history_retains_active_jobs(self):
        with tempfile.TemporaryDirectory() as temp:
            h=Host(temp,output=Path(temp)/'downloads');h.jobs={'a':{'id':'a','status':'complete'},'b':{'id':'b','status':'downloading'}};h.clear_history();self.assertEqual(set(h.jobs),{'b'});h.close()
    def test_native_cancellation_stops_process_and_cleans_temp_files(self):
        with tempfile.TemporaryDirectory() as temp:
            h=Host(temp,output=Path(temp)/'downloads');h.send=lambda _:None
            h.base_command=lambda:[sys.executable,str(Path(__file__).with_name('slow_engine.py'))]
            h.cache['fixture']={'created':time.monotonic(),'url':'https://www.youtube.com/watch?v=aqz-KE-bpKQ','selectors':{'144-webm':'1+2'},'result':{'id':'aqz-KE-bpKQ','title':'Cancellation fixture','formats':[{'id':'144-webm','label':'144p','ext':'webm'}]}}
            identifier=str(uuid.uuid4());h.start_download({'id':identifier,'token':'fixture','formatId':'144-webm'})
            deadline=time.monotonic()+10
            while identifier not in h.processes and time.monotonic()<deadline:time.sleep(.02)
            self.assertIn(identifier,h.processes)
            process=h.processes[identifier];h.cancel(identifier)
            while (h.jobs[identifier]['status'] in ('queued','downloading','processing') or identifier in h.processes) and time.monotonic()<deadline:time.sleep(.02)
            self.assertEqual(h.jobs[identifier]['status'],'cancelled');self.assertIsNotNone(process.poll())
            h.pool.shutdown(wait=True)
            self.assertFalse((Path(temp)/'state'/'work'/identifier).exists());h.close()

if __name__=='__main__':unittest.main()
