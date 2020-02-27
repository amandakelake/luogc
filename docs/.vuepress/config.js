module.exports = {
    base: '/blog/',
    title: 'LGC-amandakelake',
    description: 'LGC, amandakelake, blog, Frontend, web, Node, webpack',
    repo: 'https://github.com/amandakelake',
    head: [
        ['link', { rel: 'icon', href: 'https://s3.forcloudcdn.com/dmc/d6d10ad7-0eab-4f24-a458-36178179231e-323x323.png' }]
    ],
    themeConfig: {
        logo: 'https://s3.forcloudcdn.com/dmc/d6d10ad7-0eab-4f24-a458-36178179231e-323x323.png',
        // 添加导航栏
        nav: [
            { text: 'JS基础', link: '/js-basic' },
            { text: '框架', link: '/framework/' },
            { text: '工程化', link: '/engineering' },
            { text: '关于我', link: '/about-me' },
            { text: 'Github', link: 'https://github.com/amandakelake'}
        ],
        sidebar: [
            {
                title: 'Group 1',   // 必要的
                path: '/foo/',      // 可选的, 应该是一个绝对路径
                collapsable: false, // 可选的, 默认值是 true,
                sidebarDepth: 1,    // 可选的, 默认值是 1
                children: [
                    '/'
                ]
            },
            {
                title: 'Group 2',
                children: [ /* ... */ ]
            }
        ]
    },
    markdown: {
        lineNumbers: true
    },
};
