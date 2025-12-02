const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// 设置axios默认配置
axios.defaults.timeout = 30000;
axios.defaults.headers.common['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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

        // 检测平台类型
        const platform = detectPlatform(url);
        console.log('检测到平台:', platform);

        // 根据平台选择解析方法
        let result = null;

        if (platform === 'bilibili') {
            // B站解析
            try {
                result = await parseWithBilibili(url);
                if (result) return res.json(result);
            } catch (e) {
                console.log('B站解析失败:', e.message);
            }
        } else if (platform === 'kuaishou') {
            // 快手解析
            try {
                result = await parseWithKuaishou(url);
                if (result) return res.json(result);
            } catch (e) {
                console.log('快手解析失败:', e.message);
            }
        } else {
            // 抖音/TikTok解析 - 多重备用方案
            const parseStrategies = [
                { name: 'lolimi API', func: parseWithTikwm },
                { name: '抖音官方API', func: parseWithTikTokAPI },
                { name: 'qjqq API', func: parseWithSnapSave },
                { name: 'iiilab API', func: parseWithIIILab },
                { name: 'Realdouyin API', func: parseWithRealDouyin },
                { name: '最终备用', func: parseWithFinalBackup }
            ];

            for (const strategy of parseStrategies) {
                try {
                    console.log(`尝试: ${strategy.name}`);
                    result = await strategy.func(url);
                    if (result && result.success) {
                        console.log(`✓ ${strategy.name} 成功！`);
                        return res.json(result);
                    }
                } catch (e) {
                    console.log(`✗ ${strategy.name} 失败:`, e.message);
                }
            }
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
        // 抖音
        /(https?:\/\/)?v\.douyin\.com\/[a-zA-Z0-9]+\/?/i,
        /(https?:\/\/)?www\.douyin\.com\/video\/\d+/i,
        // TikTok
        /(https?:\/\/)?vm\.tiktok\.com\/[a-zA-Z0-9]+\/?/i,
        /(https?:\/\/)?vt\.tiktok\.com\/[a-zA-Z0-9]+\/?/i,
        /(https?:\/\/)?www\.tiktok\.com\/@[^/]+\/video\/\d+/i,
        /(https?:\/\/)?www\.tiktok\.com\/video\/\d+/i,
        // 快手
        /(https?:\/\/)?v\.kuaishou\.com\/[a-zA-Z0-9]+/i,
        /(https?:\/\/)?www\.kuaishou\.com\/short-video\/[a-zA-Z0-9]+/i,
        /(https?:\/\/)?[a-z0-9]+\.kuaishou\.com\/[^\s]+/i,
        // B站
        /(https?:\/\/)?b23\.tv\/[a-zA-Z0-9]+/i,
        /(https?:\/\/)?www\.bilibili\.com\/video\/[Bb][Vv][a-zA-Z0-9]+/i,
        /(https?:\/\/)?m\.bilibili\.com\/video\/[Bb][Vv][a-zA-Z0-9]+/i,
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

// 检测平台类型
function detectPlatform(url) {
    if (/bilibili\.com|b23\.tv/i.test(url)) {
        return 'bilibili';
    } else if (/kuaishou\.com/i.test(url)) {
        return 'kuaishou';
    } else if (/douyin\.com/i.test(url)) {
        return 'douyin';
    } else if (/tiktok\.com/i.test(url)) {
        return 'tiktok';
    }
    return 'unknown';
}

// 判断是否是短链接
function isShortUrl(url) {
    const shortPatterns = [
        /v\.douyin\.com/i,
        /vm\.tiktok\.com/i,
        /vt\.tiktok\.com/i,
        /v\.kuaishou\.com/i,
        /b23\.tv/i
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
        
        // 快手视频ID
        const kuaishouMatch = html.match(/short-video\/([a-zA-Z0-9]+)/);
        if (kuaishouMatch) {
            return `https://www.kuaishou.com/short-video/${kuaishouMatch[1]}`;
        }
        
        // B站视频ID
        const bilibiliMatch = html.match(/video\/([Bb][Vv][a-zA-Z0-9]+)/);
        if (bilibiliMatch) {
            return `https://www.bilibili.com/video/${bilibiliMatch[1]}`;
        }
        
        return url;
    } catch (e) {
        console.log('短链接解析失败，使用原链接');
        return url;
    }
}

// 方案1: 使用 iiiLab 稳定API (目前最可靠)
async function parseWithTikwm(url) {
    try {
        const apiUrl = `https://api.lolimi.cn/API/dyjx/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, {
            timeout: 20000
        });
        
        const data = response.data;
        
        if (data.code === 1 && data.data) {
            return {
                success: true,
                videoUrl: data.data.url || data.data.video_url,
                title: data.data.title || '抖音视频',
                author: data.data.author || '未知',
                thumbnail: data.data.cover,
                duration: data.data.duration
            };
        }
        
        throw new Error('解析失败');
    } catch (e) {
        console.log('lolimi API失败:', e.message);
        throw e;
    }
}

// 方案2: 备用API - Douyin Parser
async function parseWithTikTokAPI(url) {
    try {
        const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${extractDouyinId(url)}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'Referer': 'https://www.douyin.com/',
                'Cookie': ''
            },
            timeout: 20000
        });
        
        const data = response.data;
        
        if (data.aweme_detail && data.aweme_detail.video) {
            const video = data.aweme_detail.video;
            return {
                success: true,
                videoUrl: video.play_addr.url_list[0],
                title: data.aweme_detail.desc || '视频',
                author: data.aweme_detail.author.nickname || '未知',
                thumbnail: video.cover.url_list[0]
            };
        }
        
        throw new Error('备用API返回失败');
    } catch (e) {
        console.log('官方API失败:', e.message);
        // 如果失败，尝试另一个备用方案
        try {
            const apiUrl2 = `https://api.vvhan.com/api/dysp?url=${encodeURIComponent(url)}`;
            const res2 = await axios.get(apiUrl2, { timeout: 15000 });
            if (res2.data.success && res2.data.url) {
                return {
                    success: true,
                    videoUrl: res2.data.url,
                    title: res2.data.title || '视频',
                    author: res2.data.author || '未知',
                    thumbnail: res2.data.cover
                };
            }
        } catch (e2) {
            console.log('vvhan备用也失败');
        }
        throw e;
    }
}

// 提取抖音视频ID
function extractDouyinId(url) {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : '';
}

// 方案3: qjqq API
async function parseWithSnapSave(url) {
    try {
        const apiUrl = `https://api.qjqq.cn/api/Douyin?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        
        const data = response.data;
        
        if (data.code === 200 && data.data) {
            return {
                success: true,
                videoUrl: data.data.video_url || data.data.url,
                title: data.data.title || '视频',
                author: data.data.author || '未知',
                thumbnail: data.data.cover
            };
        }
        throw new Error('qjqq API失败');
    } catch (e) {
        throw e;
    }
}

// 方案4: iiilab API (高成功率)
async function parseWithIIILab(url) {
    try {
        const apiUrl = `https://api.wrtn.vip/api/video_download?api_token=free&url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        
        const data = response.data;
        
        if (data.code === 200 && data.data && data.data.video_url) {
            return {
                success: true,
                videoUrl: data.data.video_url,
                title: data.data.title || '视频',
                author: data.data.author || '未知',
                thumbnail: data.data.cover
            };
        }
        throw new Error('iiilab API失败');
    } catch (e) {
        throw e;
    }
}

// 方案5: Realdouyin API (稳定性强)
async function parseWithRealDouyin(url) {
    try {
        // 提取视频ID
        const videoId = extractDouyinId(url);
        if (!videoId) throw new Error('无法提取视频ID');
        
        const apiUrl = `https://www.iesdouyin.com/web/api/v2/aweme/iteminfo/?item_ids=${videoId}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15',
                'Referer': 'https://www.iesdouyin.com/'
            },
            timeout: 20000
        });
        
        const data = response.data;
        
        if (data.item_list && data.item_list.length > 0) {
            const item = data.item_list[0];
            const videoUrl = item.video?.play_addr?.url_list?.[0] || 
                           item.video?.download_addr?.url_list?.[0];
            
            if (videoUrl) {
                return {
                    success: true,
                    videoUrl: videoUrl,
                    title: item.desc || '视频',
                    author: item.author?.nickname || '未知',
                    thumbnail: item.video?.cover?.url_list?.[0] || item.video?.origin_cover?.url_list?.[0]
                };
            }
        }
        throw new Error('Realdouyin API失败');
    } catch (e) {
        throw e;
    }
}

// 方案6: 最终兜底方案 (多个API组合)
async function parseWithFinalBackup(url) {
    // 尝试多个小众但稳定的API
    const backupAPIs = [
        `https://api.vc6.cn/api/douyin?url=${encodeURIComponent(url)}`,
        `https://api.1314.cool/douyin/?url=${encodeURIComponent(url)}`,
        `https://api.uomg.com/api/rand.music?sort=抖音热歌榜&format=json&url=${encodeURIComponent(url)}`
    ];
    
    for (const apiUrl of backupAPIs) {
        try {
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;
            
            // 尝试从不同格式的响应中提取数据
            let videoUrl, title, author, thumbnail;
            
            if (data.data) {
                videoUrl = data.data.video_url || data.data.url || data.data.video;
                title = data.data.title || data.data.desc || '视频';
                author = data.data.author || data.data.nickname || '未知';
                thumbnail = data.data.cover || data.data.thumbnail;
            } else if (data.url || data.video_url) {
                videoUrl = data.url || data.video_url;
                title = data.title || '视频';
                author = data.author || '未知';
                thumbnail = data.cover;
            }
            
            if (videoUrl) {
                return {
                    success: true,
                    videoUrl: videoUrl,
                    title: title,
                    author: author,
                    thumbnail: thumbnail
                };
            }
        } catch (e) {
            continue; // 尝试下一个
        }
    }
    
    throw new Error('所有备用API均失败');
}

// 解析B站视频
async function parseWithBilibili(url) {
    try {
        // 方案1: 使用B站API
        const bvMatch = url.match(/[Bb][Vv]([a-zA-Z0-9]+)/);
        if (!bvMatch) throw new Error('无法提取BV号');
        
        const bvid = 'BV' + bvMatch[1];
        
        // 获取视频信息
        const infoUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
        const infoRes = await axios.get(infoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com',
                'Accept': 'application/json',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            timeout: 10000
        });
        
        if (infoRes.data.code === 0) {
            const videoInfo = infoRes.data.data;
            
            // 获取视频播放地址（需要登录，这里返回信息）
            return {
                success: true,
                platform: 'bilibili',
                videoUrl: `https://www.bilibili.com/video/${bvid}`,
                title: videoInfo.title,
                author: videoInfo.owner.name,
                thumbnail: videoInfo.pic,
                duration: videoInfo.duration,
                message: 'B站视频需要使用浏览器访问下载，或使用第三方工具'
            };
        }
        
        throw new Error('B站API返回错误');
    } catch (e) {
        console.log('B站解析失败:', e.message);
        throw e;
    }
}

// 解析快手视频
async function parseWithKuaishou(url) {
    try {
        // 方案1: 使用第三方API
        const apiUrl = `https://api.pearktrue.cn/api/video/kuaishou/?url=${encodeURIComponent(url)}`;
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            },
            timeout: 15000
        });
        
        const data = response.data;
        
        if (data.code === 200 && data.data) {
            return {
                success: true,
                platform: 'kuaishou',
                videoUrl: data.data.video_url || data.data.url,
                title: data.data.title || '快手视频',
                author: data.data.author || '未知',
                thumbnail: data.data.cover || data.data.thumbnail
            };
        }
        
        throw new Error('快手API解析失败');
    } catch (e) {
        // 方案2: 备用API
        try {
            const api2Url = `https://api.vvhan.com/api/kuaishou?url=${encodeURIComponent(url)}`;
            const response2 = await axios.get(api2Url);
            
            if (response2.data.success && response2.data.video_url) {
                return {
                    success: true,
                    platform: 'kuaishou',
                    videoUrl: response2.data.video_url,
                    title: response2.data.title || '快手视频',
                    author: response2.data.author || '未知',
                    thumbnail: response2.data.cover
                };
            }
        } catch (e2) {
            console.log('快手备用API失败:', e2.message);
        }
        
        throw new Error('快手所有API均解析失败');
    }
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
