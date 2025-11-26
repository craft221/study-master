'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-4 mt-6 text-gray-900 dark:text-white" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mb-3 mt-5 text-gray-900 dark:text-white" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-xl font-bold mb-2 mt-4 text-gray-900 dark:text-white" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-lg font-semibold mb-2 mt-3 text-gray-900 dark:text-white" {...props} />,
          h5: ({ node, ...props }) => <h5 className="text-base font-semibold mb-1 mt-2 text-gray-900 dark:text-white" {...props} />,
          h6: ({ node, ...props }) => <h6 className="text-sm font-semibold mb-1 mt-2 text-gray-900 dark:text-white" {...props} />,
          p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-gray-800 dark:text-gray-200" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-1 text-gray-800 dark:text-gray-200" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-800 dark:text-gray-200" {...props} />,
          li: ({ node, ...props }) => <li className="ml-4" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-purple-500 dark:border-purple-400 pl-4 italic my-4 text-gray-700 dark:text-gray-300" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-purple-600 dark:text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          strong: ({ node, ...props }) => <strong className="font-bold text-gray-900 dark:text-white" {...props} />,
          em: ({ node, ...props }) => <em className="italic text-gray-800 dark:text-gray-200" {...props} />,
          code: ({ node, inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-purple-600 dark:text-purple-400" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="block p-4 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-x-auto mb-4 text-sm font-mono text-gray-800 dark:text-gray-200" {...props}>
                {children}
              </code>
            )
          },
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto mb-4" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gray-50 dark:bg-gray-800" {...props} />,
          tbody: ({ node, ...props }) => <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700" {...props} />,
          tr: ({ node, ...props }) => <tr {...props} />,
          th: ({ node, ...props }) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200" {...props} />
          ),
          hr: ({ node, ...props }) => <hr className="my-6 border-gray-300 dark:border-gray-700" {...props} />,
          img: ({ node, ...props }) => (
            <img className="max-w-full h-auto rounded-lg my-4" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>

      <style jsx global>{`
        .markdown-content .katex {
          font-size: 1.1em;
        }
        .markdown-content .katex-display {
          margin: 1.5rem 0;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .markdown-content .katex-display > .katex {
          text-align: center;
        }
      `}</style>
    </div>
  )
}
