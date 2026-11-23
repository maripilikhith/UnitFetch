"""Pure validation and metadata shaping; never exposes signed media URLs to the UI."""
import re
from urllib.parse import urlparse, parse_qs

YOUTUBE_HOSTS = {'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'}
def youtube_url(value):
    if not isinstance(value, str) or len(value) > 8192:
        raise ValueError('Invalid YouTube link.')
    parsed = urlparse(value.strip())
    if parsed.scheme not in ('https', 'http') or parsed.username or parsed.password or parsed.hostname not in YOUTUBE_HOSTS or parsed.port not in (None, 80, 443):
        raise ValueError('Only a YouTube video link is accepted by this operation.')
    parts = parsed.path.split('/')
    if parsed.hostname.endswith('youtu.be'):
        video_id = parts[1] if len(parts) > 1 else ''
    elif parsed.path == '/watch':
        video_id = parse_qs(parsed.query).get('v', [''])[0]
    elif len(parts) > 2 and parts[1] in ('shorts', 'embed', 'live'):
        video_id = parts[2]
    else:
        video_id = ''
    if not re.fullmatch(r'[\w-]{11}', video_id, re.ASCII):
        raise ValueError('Use a link to one video, not a playlist or channel.')
    return f'https://www.youtube.com/watch?v={video_id}'

def safe_name(value):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', str(value)).rstrip(' .')[:140]
    if not name or re.match(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)', name, re.I):
        name = 'video_' + name
    return name

def clean_error(value):
    raw = str(value)
    lower = raw.lower()
    if 'not a bot' in lower or 'cookies-from-browser' in lower:
        return 'YouTube requested a sign-in or bot check. This video cannot be downloaded from the current connection. Try again later; UniFetch does not import browser cookies.'
    if 'timed out' in lower or 'timeout' in lower:
        return 'The video service took too long to respond. Check your connection and try again.'
    # Command output can contain temporary signed URLs. Keep them out of history and UI.
    value = re.sub(r'https?://\S+', '[media URL]', raw)
    value = re.sub(r'\x1b\[[0-9;]*m', '', value)
    lines = [line for line in value.splitlines() if line.startswith('ERROR:')]
    return (lines[-1] if lines else value[-900:]).strip()[:1200] or 'The download tool could not finish. Try inspecting the link again.'

def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None

def shape_video(info):
    if not re.fullmatch(r'[\w-]{11}',str(info.get('id','')),re.ASCII):
        raise ValueError('The extractor did not return a valid YouTube video identifier.')
    if info.get('is_live') or info.get('live_status') in ('is_live', 'is_upcoming', 'post_live'):
        raise ValueError('Live streams and premieres are not supported yet. Try a finished video.')
    if info.get('availability') in ('private', 'premium_only', 'subscriber_only', 'needs_auth'):
        raise ValueError('This video requires restricted access. UniFetch does not import sign-in cookies.')
    formats = [f for f in info.get('formats', []) if not f.get('has_drm') and re.fullmatch(r'[\w.-]+', str(f.get('format_id', '')), re.ASCII)]
    audio = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') not in (None, 'none')]
    choices = {}
    for video in formats:
        if video.get('vcodec') in (None, 'none') or not video.get('height') or video.get('ext') not in ('mp4', 'webm'):
            continue
        ext = video['ext']
        sound = None
        if video.get('acodec') in (None, 'none'):
            candidates = [f for f in audio if f.get('ext') in (('m4a', 'mp4') if ext == 'mp4' else ('webm',))]
            if not candidates:
                continue
            sound = max(candidates, key=lambda f:(number(f.get('language_preference')) or -1, number(f.get('abr')) or number(f.get('tbr')) or 0))
        selector = str(video['format_id']) + ('+' + str(sound['format_id']) if sound else '')
        height = int(video['height'])
        key = f'{height}-{ext}'
        score = (str(video.get('vcodec','')).startswith('avc1'), number(video.get('fps')) or 0, number(video.get('tbr')) or 0)
        if key in choices and choices[key]['_score'] >= score:
            continue
        size = number(video.get('filesize')) or number(video.get('filesize_approx'))
        if sound:
            audio_size = number(sound.get('filesize')) or number(sound.get('filesize_approx'))
            size = size + audio_size if size and audio_size else None
        choices[key] = {'id':key, 'label':f'{height}p · {ext.upper()} · video + audio', 'ext':ext, 'height':height, 'filesize':size, '_selector':selector, '_score':score}
    if not choices:
        raise ValueError('No downloadable video-and-audio formats were returned. This video may be restricted or temporarily unavailable.')
    ordered = sorted(choices.values(),key=lambda f:(-f['height'],f['ext']!='mp4'))
    public = [{k:v for k,v in f.items() if not k.startswith('_')} for f in ordered]
    thumbnail = info.get('thumbnail')
    if thumbnail and (urlparse(thumbnail).scheme != 'https' or urlparse(thumbnail).hostname not in ('i.ytimg.com','i9.ytimg.com')):
        thumbnail = None
    result = {'provider':'youtube','id':info.get('id'),'title':str(info.get('title') or 'YouTube video')[:300], 'hostname':'youtube.com','author':str(info.get('uploader') or '')[:200], 'duration':number(info.get('duration')),'thumbnail':thumbnail,'formats':public}
    return result, {f['id']:f['_selector'] for f in ordered}
