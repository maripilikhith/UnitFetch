"""Launch the project-local official yt-dlp package; never import a global installation."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent/'vendor'))
import yt_dlp
if __name__=='__main__':
    yt_dlp.main()
