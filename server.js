const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// 解析抖音/TikTok视频API
app.post('/api/parse', async (req, res) => {
    try {
        let { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: '请提供视频链接' });
        }

        console.log('收到解析请求:', url);

        // 从分享文本中提取URL
        url = extractUrl(url);
        console.log('提取的URL:', url);

        // 如果是短链接，先解析
        if (isShortUrl(url)) {
            url = await resolveShortUrl(url);
            console.log('解析后的URL:', url);
        }

        // 尝试多个API解析
        let result = null;

        // 方案1: tikwm.com API
        try {
            result = await parseWithTikwm(url);
            if (result) {
                return res.json(result);
            }
        } catch (e) {
            console.log('tikwm.com 失败:', e.message);
        }

        // 方案2: TikTok API Downloader
        try {
            result = await parseWithTikTokAPI(url);
            if (result) {
                return res.json(result);
            }
        } catch (e) {
            console.log('TikTok API 失败:', e.message);
        }

        // 方案3: SnapSave
        try {
            result = await parseWithSnapSave(url);
            if (result) {
                return res.json(result);
            }
        } catch (e) {
            console.log('SnapSave 失败:', e.message);
        }

        res.status(500).json({ error: '所有解析方案均失败，请稍后重试' });

    } catch (error) {
        console.error('解析错误:', error);
        res.status(500).json({ error: error.message });
    }
});

// 从文本中提取URL
function extractUrl(text) {
    const urlPatterns = [
        /(https?:\/\/)?v\.douyin\.com\/[a-zA-Z0-9]+\/?/i,
        /(https?:\/\/)?vm\.tiktok\.com\/[a-zA-Z0-9]+\/?/i,
        /(https?:\/\/)?vt\.tiktok\.com\/[a-zA-Z0-9]+\/?/i,
        /(https?:\/\/)?www\.douyin\.com\/video\/\d+/i,
        /(https?:\/\/)?www\.tiktok\.com\/@[^/]+\/video\/\d+/i,
        /(https?:\/\/)?www\.tiktok\.com\/video\/\d+/i,
    ];
    
    for (const pattern of urlPatterns) {
        const match = text.match(pattern);
        if (match) {
            let url = match[0];
            if (!url.startsWith('http')) {
                url = 'https://' + url;
            }
            return url;
        }
    }
    
    return text.trim();
}

// 判断是否是短链接
function isShortUrl(url) {
    const shortPatterns = [
        /v\.douyin\.com/i,
        /vm\.tiktok\.com/i,
        /vt\.tiktok\.com/i
    ];
    return shortPatterns.some(pattern => pattern.test(url));
}

// 解析短链接
async function resolveShortUrl(url) {
    try {
        const response = await axios.get(url, {
            maxRedirects: 5,
            validateStatus: false
        });
        
        // 从HTML中提取视频ID
        const html = response.data;
        
        // 抖音视频ID
        const douyinMatch = html.match(/video\/(\d{19})/);
        if (douyinMatch) {
            return `https://www.douyin.com/video/${douyinMatch[1]}`;
        }
        
        // TikTok视频ID
        const tiktokMatch = html.match(/\/video\/(\d+)/);
        if (tiktokMatch) {
            return `https://www.tiktok.com/video/${tiktokMatch[1]}`;
        }
        
        return url;
    } catch (e) {
        console.log('短链接解析失败，使用原链接');
        return url;
    }
}

// 使用 tikwm.com API
async function parseWithTikwm(url) {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const response = await axios.get(apiUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    
    const data = response.data;
    
    if (data.code === 0 && data.data) {
        return {
            success: true,
            videoUrl: data.data.play || data.data.wmplay,
            title: data.data.title || '视频',
            author: data.data.author?.nickname || '未知',
            thumbnail: data.data.cover,
            duration: data.data.duration
        };
    }
    
    throw new Error('tikwm API 返回失败');
}

// 使用 TikTok API
async function parseWithTikTokAPI(url) {
    const apiUrl = 'https://tiktok-video-no-watermark2.p.rapidapi.com/';
    const response = await axios.get(apiUrl, {
        params: { url },
        headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || 'demo', // 需要API key
            'X-RapidAPI-Host': 'tiktok-video-no-watermark2.p.rapidapi.com'
        }
    });
    
    const data = response.data;
    
    if (data.data && data.data.play) {
        return {
            success: true,
            videoUrl: data.data.play,
            title: data.data.title || '视频',
            author: data.data.author?.nickname || '未知',
            thumbnail: data.data.cover
        };
    }
    
    throw new Error('TikTok API 返回失败');
}

// 使用 SnapSave
async function parseWithSnapSave(url) {
    const apiUrl = 'https://snapsave.app/action.php';
    const response = await axios.post(apiUrl, 
        `url=${encodeURIComponent(url)}`,
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0'
            }
        }
    );
    
    const data = response.data;
    
    if (data.status === 'ok' && data.data) {
        return {
            success: true,
            videoUrl: data.data.videoUrl || data.data.url,
            title: data.data.title || '视频',
            author: data.data.author || '未知',
            thumbnail: data.data.thumbnail
        };
    }
    
    throw new Error('SnapSave API 返回失败');
}

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📱 访问: http://localhost:${PORT}`);
});
