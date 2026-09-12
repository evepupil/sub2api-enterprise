/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色调 - 深海蓝。整条刻度按同一个色相往两头推，
        // 比默认蓝压深、降饱和，偏金融稳重。
        // 操作色 600，悬停 700，按下 800；深底上的强调文字用 400。
        primary: {
          50: '#f2f6fd',
          100: '#e1e9fa',
          200: '#bed0f4',
          300: '#8eadeb',
          400: '#5080e2',
          500: '#225dd3',
          600: '#1b4ba8',
          700: '#163c88',
          800: '#12306e',
          900: '#0f2757',
          950: '#0a1938'
        },
        // 语义表面色 - 底层是 CSS 变量，明暗两套值在 style.css 里定义。
        // 用 bg-surface-raised 这类写法就自动适配深色，不必再写 dark: 变体。
        // 老代码里的 dark: 变体继续有效，两套并存，逐页收编。
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
          sunken: 'rgb(var(--surface-sunken) / <alpha-value>)'
        },
        line: {
          subtle: 'rgb(var(--line-subtle) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)'
        },
        content: {
          strong: 'rgb(var(--content-strong) / <alpha-value>)',
          DEFAULT: 'rgb(var(--content) / <alpha-value>)',
          muted: 'rgb(var(--content-muted) / <alpha-value>)',
          subtle: 'rgb(var(--content-subtle) / <alpha-value>)'
        },
        // 中性灰整体换暖调，不带蓝。全站上百处 text-gray-500、bg-gray-50
        // 这类写法会一起跟过来，所以这是"质感"变化最大的一项。
        gray: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09'
        },
        // 辅助色 - 暖中性
        accent: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09'
        },
        // 深色模式背景。档位含义不变：950 页面底、800 卡片、700 边框、
        // 400 次要文字，老代码里的 dark:bg-dark-800 这类写法照旧生效。
        dark: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d4d0cb',
          400: '#96918b',
          500: '#706b65',
          600: '#3f3b37',
          700: '#2c2926',
          800: '#1f1d1b',
          900: '#171614',
          950: '#0f0e0d'
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      // 阴影压扁：卡片靠 1px 边框分层，不靠阴影；
      // 阴影只留给真正浮在页面之上的东西（下拉、气泡、弹窗）。
      boxShadow: {
        glass: '0 4px 16px rgba(15, 23, 42, 0.06)',
        'glass-sm': '0 2px 8px rgba(15, 23, 42, 0.05)',
        glow: '0 0 0 3px rgba(27, 75, 168, 0.12)',
        'glow-lg': '0 0 0 4px rgba(27, 75, 168, 0.16)',
        card: 'none',
        'card-hover': '0 2px 8px rgba(15, 23, 42, 0.06)',
        pop: '0 4px 12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06)',
        dialog: '0 16px 48px rgba(15, 23, 42, 0.16)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.06)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #1b4ba8 0%, #163c88 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'mesh-gradient':
          'radial-gradient(at 40% 20%, rgba(27, 75, 168, 0.10) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(34, 93, 211, 0.07) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(27, 75, 168, 0.06) 0px, transparent 50%)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 0 0 2px rgba(27, 75, 168, 0.18)' },
          '100%': { boxShadow: '0 0 0 4px rgba(27, 75, 168, 0.26)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      // 圆角整体收紧一档。重映射刻度而不是逐个文件改，
      // 现有的 rounded-lg / rounded-xl / rounded-2xl 写法自动跟着变紧。
      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
        md: '5px',
        lg: '6px',
        xl: '8px',
        '2xl': '10px',
        '3xl': '12px',
        '4xl': '16px'
      }
    }
  },
  plugins: []
}
