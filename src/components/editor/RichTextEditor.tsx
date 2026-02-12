import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from 'lucide-react'
import clsx from 'clsx'

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    editable?: boolean;
}

export function RichTextEditor({ value, onChange, editable = true }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline cursor-pointer',
                },
            }),
        ],
        content: value,
        editable: editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
        editorProps: {
            attributes: {
                class: clsx(
                    'prose prose-invert max-w-none focus:outline-none min-h-[80px] text-xs text-muted-foreground/90 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4',
                    !editable && 'pointer-events-none'
                ),
            },
        },
    })

    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            editor.commands.setContent(value)
        }
    }, [value, editor])

    if (!editor) {
        return null
    }

    if (!editable) {
        return <EditorContent editor={editor} className="bg-transparent" />
    }

    return (
        <div className="flex flex-col rounded-xl border border-white/5 bg-background/40 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 border-b border-white/5 bg-white/5 p-1.5">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        editor.isActive('bold') ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                    type="button"
                >
                    <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        editor.isActive('italic') ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                    type="button"
                >
                    <Italic className="h-3.5 w-3.5" />
                </button>
                <div className="h-4 w-[1px] bg-white/5 mx-1" />
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        editor.isActive('bulletList') ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                    type="button"
                >
                    <List className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        editor.isActive('orderedList') ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                    type="button"
                >
                    <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <div className="h-4 w-[1px] bg-white/5 mx-1" />
                <button
                    onClick={() => {
                        const previousUrl = editor.getAttributes('link').href
                        const url = window.prompt('URL', previousUrl)
                        if (url === null) return
                        if (url === '') {
                            editor.chain().focus().extendMarkRange('link').unsetLink().run()
                            return
                        }
                        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
                    }}
                    className={clsx(
                        "p-1.5 rounded-lg transition-colors",
                        editor.isActive('link') ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                    type="button"
                >
                    <LinkIcon className="h-3.5 w-3.5" />
                </button>
            </div>

            {/* Content Area */}
            <div className="p-3">
                <EditorContent editor={editor} />
            </div>
        </div>
    )
}
