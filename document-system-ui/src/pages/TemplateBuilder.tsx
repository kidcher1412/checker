import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Gapcursor from '@tiptap/extension-gapcursor';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Image from '@tiptap/extension-image';
import { Save, FileJson, ArrowLeft, Type, LayoutTemplate, PlusCircle, AlignLeft, AlignCenter, AlignRight, Eye, Edit3, Settings, PaintBucket, Settings2, X, Trash2, Terminal, Image as ImageIcon, Columns as ColumnsIcon, MinusCircle, Hand } from 'lucide-react';
import { Extension, mergeAttributes, Node } from '@tiptap/core';
import { useNavigate, useParams } from 'react-router-dom';
import * as Handlebars from 'handlebars';
import { toast } from 'react-toastify';
import api from '../services/api';
import VersionTimelineManager from '../components/VersionTimelineManager';

interface WatermarkConfig {
    id: string;
    type: 'text' | 'image';
    imageUrl?: string;
    text: string;
    opacity: number;
    fontSize: number;
    rotation: number;
    color: string;
    position: 'top-left' | 'center' | 'bottom-right' | 'tiled' | 'custom';
    customX?: number;
    customY?: number;
    layer: 'background' | 'foreground';
    pages: string; // e.g. "1-3, 5" or empty for all
    conditionVariable?: string;
}

const MOCK_VARIABLES = [
    { name: 'customerName', label: 'Customer Name' },
    { name: 'orderId', label: 'Order ID' },
    { name: 'totalAmount', label: 'Total Amount' },
    { name: 'currentDate', label: 'Current Date' },
];

const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            'data-border-top': { default: null },
            'data-border-bottom': { default: null },
            'data-border-left': { default: null },
            'data-border-right': { default: null },
            backgroundColor: {
                default: null,
                parseHTML: element => element.style.backgroundColor || null,
                renderHTML: attributes => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                },
            },
        };
    },
});

const CustomTableHeader = TableHeader.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            'data-border-top': { default: null },
            'data-border-bottom': { default: null },
            'data-border-left': { default: null },
            'data-border-right': { default: null },
            backgroundColor: {
                default: null,
                parseHTML: element => element.style.backgroundColor || null,
                renderHTML: attributes => {
                    if (!attributes.backgroundColor) return {};
                    return { style: `background-color: ${attributes.backgroundColor}` };
                },
            },
        };
    },
});

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        }
    }
}

const FontSize = Extension.create({
    name: 'fontSize',
    addOptions() { return { types: ['textStyle'] }; },
    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: any) => element.style.fontSize?.replace(/['"]+/g, ''),
                        renderHTML: (attributes: any) => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            setFontSize: (fontSize: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize }).run(),
            unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
        };
    },
});

const ResizableImageNode = (props: any) => {
    const { node, updateAttributes, selected } = props;
    const { src, alt, title, width, wrapType, x, y } = node.attrs;
    const [isDragging, setIsDragging] = useState(false);

    let styleObj: React.CSSProperties = { display: 'inline-block', margin: '0' };
    if (wrapType === 'square-left') styleObj = { float: 'left', margin: '0 15px 15px 0' };
    else if (wrapType === 'square-right') styleObj = { float: 'right', margin: '0 0 15px 15px' };
    else if (wrapType === 'top-bottom') styleObj = { display: 'block', clear: 'both', margin: '15px auto' };
    else if (wrapType === 'behind') styleObj = { position: 'absolute', zIndex: -1, margin: 0, left: `${x}px`, top: `${y}px` };
    else if (wrapType === 'front') styleObj = { position: 'absolute', zIndex: 10, margin: 0, left: `${x}px`, top: `${y}px` };

    let wrapperClass = '';
    if (wrapType === 'behind' || wrapType === 'front') wrapperClass += 'is-absolute-image ';
    if (isDragging) wrapperClass += 'dragging-active ';

    return (
        <NodeViewWrapper as="span" style={styleObj} className={wrapperClass.trim()}>
            <span className={`relative inline-block ${selected ? 'ring-2 ring-blue-500' : ''}`} style={{ width: width || '200px' }}>
                <img
                    src={src}
                    alt={alt}
                    title={title}
                    style={{ width: '100%', display: 'block' }}
                    data-drag-handle={wrapType !== 'behind' && wrapType !== 'front' ? "true" : undefined}
                />

                {selected && (wrapType === 'behind' || wrapType === 'front') && (
                    <div
                        className="absolute -top-3 -left-3 w-6 h-6 bg-white border border-gray-300 rounded-full shadow flex items-center justify-center z-20 cursor-move"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(true);
                            document.body.classList.add('is-dragging-overlay');

                            const startX = e.pageX;
                            const startY = e.pageY;
                            const startNodeX = parseInt(x || 0, 10);
                            const startNodeY = parseInt(y || 0, 10);

                            // Adjust for editor zoom
                            const zoomMatches = document.querySelector('.ProseMirror')?.parentElement?.style.transform.match(/scale\(([^)]+)\)/);
                            const zoom = zoomMatches ? parseFloat(zoomMatches[1]) : 1;

                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const dx = (moveEvent.pageX - startX) / zoom;
                                const dy = (moveEvent.pageY - startY) / zoom;
                                updateAttributes({ x: startNodeX + dx, y: startNodeY + dy });
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                                setIsDragging(false);
                                document.body.classList.remove('is-dragging-overlay');
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                    >
                        <Hand size={12} className="text-gray-500" />
                    </div>
                )}

                {selected && (
                    <div
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-600 border border-white cursor-nwse-resize z-20"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDragging(true);
                            document.body.classList.add('is-dragging-overlay');

                            const startX = e.pageX;
                            const startWidth = parseInt(width || '200', 10);

                            const zoomMatches = document.querySelector('.ProseMirror')?.parentElement?.style.transform.match(/scale\(([^)]+)\)/);
                            const zoom = zoomMatches ? parseFloat(zoomMatches[1]) : 1;

                            const onMouseMove = (moveEvent: MouseEvent) => {
                                const newWidth = Math.max(50, startWidth + (moveEvent.pageX - startX) / zoom);
                                updateAttributes({ width: newWidth + 'px' });
                            };
                            const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                                setIsDragging(false);
                                document.body.classList.remove('is-dragging-overlay');
                            };
                            document.addEventListener('mousemove', onMouseMove);
                            document.addEventListener('mouseup', onMouseUp);
                        }}
                    />
                )}
            </span>
        </NodeViewWrapper>
    );
};

const CustomImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: '200px',
                parseHTML: element => element.style.width || element.getAttribute('width') || '200px',
            },
            wrapType: {
                default: 'inline',
                parseHTML: (element: any) => element.getAttribute('data-wrap') || 'inline',
                renderHTML: (attributes: any) => {
                    return { 'data-wrap': attributes.wrapType };
                }
            },
            x: {
                default: 0,
                parseHTML: (element: any) => parseInt(element.getAttribute('data-x') || '0', 10),
                renderHTML: (attributes: any) => ({ 'data-x': attributes.x })
            },
            y: {
                default: 0,
                parseHTML: (element: any) => parseInt(element.getAttribute('data-y') || '0', 10),
                renderHTML: (attributes: any) => ({ 'data-y': attributes.y })
            }
        };
    },
    renderHTML({ HTMLAttributes }: any) {
        let style = `width: ${HTMLAttributes.width || '200px'}; `;
        const wrap = HTMLAttributes['data-wrap'];
        const x = HTMLAttributes['data-x'] || 0;
        const y = HTMLAttributes['data-y'] || 0;

        if (wrap === 'square-left') style += 'float: left; margin: 0 15px 15px 0; ';
        else if (wrap === 'square-right') style += 'float: right; margin: 0 0 15px 15px; ';
        else if (wrap === 'top-bottom') style += 'display: block; clear: both; margin: 15px auto; ';
        else if (wrap === 'behind') style += `position: absolute; z-index: -1; margin: 0; left: ${x}px; top: ${y}px; `;
        else if (wrap === 'front') style += `position: absolute; z-index: 10; margin: 0; left: ${x}px; top: ${y}px; `;
        else style += 'display: inline-block; margin: 0; ';

        return ['img', { ...HTMLAttributes, style }];
    },
    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageNode);
    }
});

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        multiColumn: {
            setColumns: (cols: number) => ReturnType;
            unsetColumns: () => ReturnType;
        }
    }
}

const MultiColumn = Node.create({
    name: 'multiColumn',
    group: 'block',
    content: 'block+',

    addAttributes() {
        return {
            cols: {
                default: 2,
                parseHTML: (element: any) => element.getAttribute('data-cols') || 2,
                renderHTML: (attributes: any) => {
                    return {
                        'data-cols': attributes.cols,
                        style: `column-count: ${attributes.cols}; column-gap: 32px;`,
                    }
                }
            }
        }
    },
    parseHTML() {
        return [{ tag: 'div[data-cols]' }]
    },
    renderHTML({ HTMLAttributes }: any) {
        return ['div', mergeAttributes(HTMLAttributes, { class: 'multi-column' }), 0]
    },
    addCommands() {
        return {
            setColumns: (cols: number) => ({ commands }: any) => {
                return commands.wrapIn('multiColumn', { cols })
            },
            unsetColumns: () => ({ commands }: any) => {
                return commands.lift('multiColumn')
            }
        }
    }
});

const TemplateBuilder: React.FC = () => {
    const navigate = useNavigate();
    const { id: templateCodeParam } = useParams<{ id: string }>();

    const [templateName, setTemplateName] = useState('New Invoice Template');
    const [templateCode, setTemplateCode] = useState(templateCodeParam || '');
    const [pageSize, setPageSize] = useState('A4');
    const [fontSizeInput, setFontSizeInput] = useState('16px');

    // Preview Mode State
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [previewJson, setPreviewJson] = useState('{\n  "customerName": "John Doe",\n  "orderId": "ORD-12345",\n  "totalAmount": "$150.00",\n  "currentDate": "2026-02-25"\n}');

    const [isTableMenuOpen, setIsTableMenuOpen] = useState(false);
    useEffect(() => {
        const handleClick = () => setIsTableMenuOpen(false);
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Alt-Key Reveal Images behind text
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                e.preventDefault();
                document.body.classList.add('reveal-behind-images');
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                document.body.classList.remove('reveal-behind-images');
            }
        };
        const handleBlur = () => document.body.classList.remove('reveal-behind-images');

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    // Time-based versioning state
    const [isTimeBased, setIsTimeBased] = useState(false);
    const [validFrom, setValidFrom] = useState('');
    const [validTo, setValidTo] = useState('');
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);
    const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
    const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);

    const [watermarks, setWatermarks] = useState<WatermarkConfig[]>([]);
    const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);
    const [editingWatermark, setEditingWatermark] = useState<WatermarkConfig | null>(null);

    const [pageConfig, setPageConfig] = useState({
        margins: { top: 1, bottom: 1, left: 1, right: 1 },
        orientation: 'portrait',
        showPageNumbers: false,
        hideFirstPageNumber: false
    });
    const [isPageConfigMenuOpen, setIsPageConfigMenuOpen] = useState(false);
    const [previewZoom, setPreviewZoom] = useState(40);
    const [editorZoom, setEditorZoom] = useState(40);

    const [isCurlModalOpen, setIsCurlModalOpen] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const role = payload.roles?.[0]?.name;
                if (role && role.toLowerCase().includes('admin')) setIsAdmin(true);
            } catch (e) { }
        }
    }, []);

    const openWatermarkModal = (wm?: WatermarkConfig) => {
        if (wm) {
            setEditingWatermark(wm);
        } else {
            setEditingWatermark({
                id: Math.random().toString(36).substr(2, 9),
                type: 'text',
                text: 'CONFIDENTIAL',
                opacity: 0.15,
                fontSize: 64,
                rotation: -45,
                color: '#000000',
                position: 'center',
                customX: 50,
                customY: 50,
                layer: 'background',
                pages: ''
            });
        }
        setIsWatermarkModalOpen(true);
    };

    const saveWatermark = () => {
        if (!editingWatermark) return;
        setWatermarks(prev => {
            const exists = prev.find(w => w.id === editingWatermark.id);
            if (exists) return prev.map(w => w.id === editingWatermark.id ? editingWatermark : w);
            return [...prev, editingWatermark];
        });
        setIsWatermarkModalOpen(false);
        setEditingWatermark(null);
    };

    const deleteWatermark = (id: string) => {
        setWatermarks(prev => prev.filter(w => w.id !== id));
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            Gapcursor,
            Table.configure({ resizable: true }),
            TableRow,
            CustomTableHeader,
            CustomTableCell,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyle,
            Color,
            FontSize,
            CustomImage.configure({ allowBase64: true }),
            MultiColumn,
        ],
        content: `
            <h1>Hello {{customerName}}</h1>
            <p>Thank you for your order ({{orderId}}).</p>
            <p>Your total comes to <strong>{{totalAmount}}</strong> on {{currentDate}}.</p>
        `,
        editorProps: {
            attributes: {
                class: 'prose max-w-none focus:outline-none bg-white shadow-sm border border-gray-200 transition-all duration-300 mx-auto',
            }
        },
        onSelectionUpdate: ({ editor }) => {
            const currentSize = editor.getAttributes('textStyle').fontSize;
            if (currentSize) setFontSizeInput(currentSize);
        }
    });

    const loadSpecificVersion = (versionNumber: number) => {
        if (!templateCodeParam || !editor) return;
        api.get(`/templates/${templateCodeParam}`).then(res => {
            const results = Array.isArray(res.data) ? res.data : [res.data];
            const template = results.find((t: any) => t.version === versionNumber);
            if (template) {
                setTemplateName(template.templateName);
                setTemplateCode(template.templateCode);
                setIsTimeBased(template.isTimeBased);
                setCurrentVersionId(template.id);
                setCurrentVersionNumber(template.version);
                if (template.validFrom) setValidFrom(new Date(template.validFrom).toISOString().slice(0, 16));
                else setValidFrom('');
                if (template.validTo) setValidTo(new Date(template.validTo).toISOString().slice(0, 16));
                else setValidTo('');
                try {
                    if (template.watermarks) setWatermarks(typeof template.watermarks === 'string' ? JSON.parse(template.watermarks) : template.watermarks);
                    else setWatermarks([]);
                } catch (e) { setWatermarks([]); }
                try {
                    if (template.pageConfig) setPageConfig(typeof template.pageConfig === 'string' ? JSON.parse(template.pageConfig) : template.pageConfig);
                } catch (e) { }
                editor.commands.setContent(template.templateLayout);
                toast.info(`Loaded version v${versionNumber}`);
            }
        });
    };

    useEffect(() => {
        if (templateCodeParam && editor) {
            api.get(`/templates/${templateCodeParam}`).then(res => {
                const results = Array.isArray(res.data) ? res.data : [res.data];
                if (results.length > 0) {
                    // Load the newest version by default on mount
                    const template = results.sort((a, b) => b.version - a.version)[0];
                    setTemplateName(template.templateName);
                    setTemplateCode(template.templateCode);
                    setIsTimeBased(template.isTimeBased);
                    setCurrentVersionId(template.id);
                    setCurrentVersionNumber(template.version);
                    if (template.validFrom) setValidFrom(new Date(template.validFrom).toISOString().slice(0, 16));
                    if (template.validTo) setValidTo(new Date(template.validTo).toISOString().slice(0, 16));
                    try {
                        if (template.watermarks) setWatermarks(typeof template.watermarks === 'string' ? JSON.parse(template.watermarks) : template.watermarks);
                        else setWatermarks([]);
                    } catch (e) { setWatermarks([]); }
                    editor.commands.setContent(template.templateLayout);
                }
            }).catch(() => toast.error('Failed to load template'));
        }
    }, [templateCodeParam, editor]);

    // Format Date string appending generic hours if needed
    const formatDateTime = (dateStr: string, isEndStart: boolean) => {
        if (!dateStr) return null;
        if (dateStr.length === 10) { // e.g. YYYY-MM-DD
            return new Date(`${dateStr}T${isEndStart ? '23:59:59' : '00:00:00'}`).toISOString();
        }
        return new Date(dateStr).toISOString();
    };

    const handleSave = async (isNewVersion: boolean) => {
        if (!templateCode) return toast.warn('Template Code is required');
        try {
            const payload = {
                templateName,
                templateCode,
                schemaVariables: JSON.stringify(MOCK_VARIABLES),
                templateLayout: editor?.getHTML() || '',
                isTimeBased,
                validFrom: isTimeBased ? formatDateTime(validFrom, false) : null,
                validTo: isTimeBased ? formatDateTime(validTo, true) : null,
                watermarks: JSON.stringify(watermarks),
            };

            if (!isNewVersion && currentVersionId) {
                await api.put(`/templates/${currentVersionId}`, payload);
                toast.success(`Template updated (v${currentVersionNumber}) successfully!`);
            } else {
                await api.post('/templates', payload);
                toast.success('New template version created successfully!');
            }
            navigate('/templates');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save template');
        }
    };

    const handleDownloadDemoPDF = async () => {
        const loadingToast = toast.loading("Đang tạo PDF Demo...");
        try {
            const dataToSubmit = previewJson ? JSON.parse(previewJson) : {};
            const res = await api.post('/templates/preview-pdf', {
                templateCode,
                data: dataToSubmit,
                version: currentVersionNumber || undefined,
                layout: editor?.getHTML() || '',
                watermarks: watermarks
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `demo-${templateCode || 'PREVIEW'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.dismiss(loadingToast);
            toast.success("Tải Demo PDF thành công!");
        } catch (e: any) {
            toast.dismiss(loadingToast);
            toast.error("Lỗi khi tải Demo PDF. Kiểm tra lại API và JSON Schema.");
        }
    };

    const handleDownloadDemoHTML = async () => {
        const loadingToast = toast.loading("Đang tạo HTML thuần...");
        try {
            const dataToSubmit = previewJson ? JSON.parse(previewJson) : {};
            const res = await api.post('/templates/preview-raw-html', {
                templateCode,
                data: dataToSubmit,
                version: currentVersionNumber || undefined,
                layout: editor?.getHTML() || '',
                watermarks: watermarks
            }, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `demo-${templateCode || 'PREVIEW'}.html`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.dismiss(loadingToast);
            toast.success("Tải HTML thành công!");
        } catch (e: any) {
            toast.dismiss(loadingToast);
            toast.error("Lỗi khi tải HTML.");
        }
    };

    const insertVariable = (variableName: string) => {
        if (editor) {
            editor.chain().focus().insertContent(`{{${variableName}}}`).run();
        }
    };

    const addTable = () => {
        if (editor) {
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        }
    };

    const toggleBorder = (side: 'top' | 'bottom' | 'left' | 'right') => {
        if (!editor) return;
        const attr = `data-border-${side}`;
        const currentValCell = editor.getAttributes('tableCell')?.[attr];
        const currentValHeader = editor.getAttributes('tableHeader')?.[attr];

        // Toggle 'none' or null
        const newVal = (currentValCell === 'none' || currentValHeader === 'none') ? null : 'none';

        editor.chain().focus().updateAttributes('tableCell', { [attr]: newVal }).run();
        editor.chain().focus().updateAttributes('tableHeader', { [attr]: newVal }).run();
    };

    const renderPreviewHTML = () => {
        if (!editor) return [];
        try {
            const data = previewJson ? JSON.parse(previewJson) : {};
            const template = Handlebars.compile(editor.getHTML());
            const fullHtml = template(data);
            return fullHtml.split(/<hr[^>]*>/gi);
        } catch (e: any) {
            return [`<div style="color: red; padding: 20px;"><strong>Error Rendering Preview:</strong><br/>${e.message}</div>`];
        }
    };

    return (
        <div className="h-full flex flex-col -m-6">
            {/* Header Toolbar */}
            <div className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0 z-[100] relative">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/templates')} className="text-gray-500 hover:bg-gray-100 p-2 rounded-md transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <input
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="text-xl font-bold text-gray-900 border-none focus:ring-0 bg-transparent p-0 placeholder-gray-400"
                            placeholder="Template Name"
                        />
                        <input
                            value={templateCode}
                            onChange={(e) => setTemplateCode(e.target.value.toUpperCase())}
                            className="text-xs font-mono text-gray-500 border-none focus:ring-0 bg-transparent p-0 placeholder-gray-300 uppercase"
                            placeholder="TEMPLATE_CODE"
                            disabled={!!templateCodeParam}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsPreviewMode(!isPreviewMode)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md transition border ${isPreviewMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                    >
                        {isPreviewMode ? <><Edit3 size={18} /> Edit</> : <><Eye size={18} /> Preview</>}
                    </button>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(e.target.value)}
                        className="border-gray-200 rounded-md text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                        <option value="A4">A4 (210x297mm)</option>
                        <option value="A5">A5 (148x210mm)</option>
                        <option value="LETTER">US Letter</option>
                    </select>

                    <div className="relative">
                        <button
                            onClick={() => setIsPageConfigMenuOpen(!isPageConfigMenuOpen)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition font-medium border ${isPageConfigMenuOpen ? 'bg-gray-100 border-gray-400 text-gray-800' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                            <LayoutTemplate size={16} /> Page Setup
                        </button>

                        {isPageConfigMenuOpen && (
                            <div className="absolute right-0 top-full mt-2 w-[320px] bg-white rounded-lg shadow-xl border border-gray-200 z-[100] overflow-hidden">
                                <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                    <h4 className="font-semibold text-gray-700 text-sm">Advanced Page Layout</h4>
                                    <button onClick={() => setIsPageConfigMenuOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Orientation</label>
                                        <div className="flex bg-gray-100 p-1 rounded-md">
                                            <button
                                                onClick={() => setPageConfig({ ...pageConfig, orientation: 'portrait' })}
                                                className={`flex-1 text-sm py-1.5 rounded transition font-medium ${pageConfig.orientation === 'portrait' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
                                            >Portrait</button>
                                            <button
                                                onClick={() => setPageConfig({ ...pageConfig, orientation: 'landscape' })}
                                                className={`flex-1 text-sm py-1.5 rounded transition font-medium ${pageConfig.orientation === 'landscape' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
                                            >Landscape</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Document Margins (in)</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2">
                                                <span className="text-xs text-gray-500 w-12">Top:</span>
                                                <input type="number" step="0.1" value={pageConfig.margins?.top || 0} onChange={e => setPageConfig({ ...pageConfig, margins: { ...pageConfig.margins, top: parseFloat(e.target.value) || 0 } })} className="w-full text-sm bg-transparent border-none focus:ring-0 p-1 text-right" />
                                            </div>
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2">
                                                <span className="text-xs text-gray-500 w-12">Bot:</span>
                                                <input type="number" step="0.1" value={pageConfig.margins?.bottom || 0} onChange={e => setPageConfig({ ...pageConfig, margins: { ...pageConfig.margins, bottom: parseFloat(e.target.value) || 0 } })} className="w-full text-sm bg-transparent border-none focus:ring-0 p-1 text-right" />
                                            </div>
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2">
                                                <span className="text-xs text-gray-500 w-12">Left:</span>
                                                <input type="number" step="0.1" value={pageConfig.margins?.left || 0} onChange={e => setPageConfig({ ...pageConfig, margins: { ...pageConfig.margins, left: parseFloat(e.target.value) || 0 } })} className="w-full text-sm bg-transparent border-none focus:ring-0 p-1 text-right" />
                                            </div>
                                            <div className="flex items-center bg-gray-50 border border-gray-200 rounded px-2">
                                                <span className="text-xs text-gray-500 w-12">Right:</span>
                                                <input type="number" step="0.1" value={pageConfig.margins?.right || 0} onChange={e => setPageConfig({ ...pageConfig, margins: { ...pageConfig.margins, right: parseFloat(e.target.value) || 0 } })} className="w-full text-sm bg-transparent border-none focus:ring-0 p-1 text-right" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">View Zoom: <span className="text-blue-600 font-normal">{isPreviewMode ? previewZoom : editorZoom}%</span></label>
                                        <div className="flex items-center gap-2">
                                            <MinusCircle size={16} className="text-gray-400 cursor-pointer hover:text-blue-600" onClick={() => (isPreviewMode ? setPreviewZoom(Math.max(20, previewZoom - 10)) : setEditorZoom(Math.max(20, editorZoom - 10)))} />
                                            <input
                                                type="range"
                                                min="20"
                                                max="200"
                                                step="10"
                                                value={isPreviewMode ? previewZoom : editorZoom}
                                                onChange={(e) => (isPreviewMode ? setPreviewZoom(Number(e.target.value)) : setEditorZoom(Number(e.target.value)))}
                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                            <PlusCircle size={16} className="text-gray-400 cursor-pointer hover:text-blue-600" onClick={() => (isPreviewMode ? setPreviewZoom(Math.min(200, previewZoom + 10)) : setEditorZoom(Math.min(200, editorZoom + 10)))} />
                                        </div>
                                    </div>

                                    <div className="space-y-2 border-t border-gray-100 pt-4">
                                        <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Pagination Setup</label>
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input type="checkbox" checked={pageConfig.showPageNumbers} onChange={e => setPageConfig({ ...pageConfig, showPageNumbers: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4 cursor-pointer" />
                                            <span className="text-sm text-gray-700 group-hover:text-blue-600 transition">Show Page Numbers</span>
                                        </label>
                                        <label className={`flex items-center gap-2 transition ${!pageConfig.showPageNumbers ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}`}>
                                            <input type="checkbox" disabled={!pageConfig.showPageNumbers} checked={pageConfig.hideFirstPageNumber} onChange={e => setPageConfig({ ...pageConfig, hideFirstPageNumber: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4 cursor-pointer" />
                                            <span className="text-sm text-gray-700 group-hover:text-blue-600 transition tracking-tight">Hide on First Page (Cover)</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex bg-gray-100 p-1 border border-gray-200 rounded-md shadow-sm gap-1">
                        <button onClick={() => setIsCurlModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded transition font-medium bg-gray-800 text-white hover:bg-gray-700">
                            <Terminal size={16} /> Tạo cURL lấy báo cáo
                        </button>
                        {currentVersionId && (
                            <button onClick={() => handleSave(false)} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 text-sm rounded hover:bg-blue-700 transition font-medium">
                                <Save size={16} /> Save to v{currentVersionNumber}
                            </button>
                        )}
                        <button onClick={() => handleSave(true)} className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition font-medium border ${!currentVersionId ? 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}>
                            <PlusCircle size={16} /> Save New Version
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main Content Area */}
                {isPreviewMode ? (
                    // PREVIEW SPLIT VIEW
                    <div className="flex-1 flex bg-gray-50 overflow-hidden">
                        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                            <div className="p-4 border-b border-gray-200 bg-gray-50 font-medium flex items-center gap-2">
                                <FileJson size={18} /> JSON Data Payload
                            </div>
                            <textarea
                                value={previewJson}
                                onChange={(e) => setPreviewJson(e.target.value)}
                                className="flex-1 p-4 font-mono text-sm border-none focus:ring-0 resize-none bg-gray-50"
                                spellCheck="false"
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative flex flex-col items-center gap-8 bg-gray-300">
                            {/* Zoom Controls */}
                            <div className="fixed bottom-6 right-6 z-50 bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-500 w-10">{previewZoom}%</span>
                                <input type="range" min="30" max="150" value={previewZoom} onChange={(e) => setPreviewZoom(parseInt(e.target.value))} className="w-24 accent-blue-600" />
                                <button onClick={() => setPreviewZoom(100)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Reset</button>
                            </div>

                            {renderPreviewHTML().map((pageHtml, index) => {
                                const pageWidth = pageSize === 'A4' ? (pageConfig.orientation === 'landscape' ? '297mm' : '210mm') : pageSize === 'A5' ? '148mm' : '8.5in';
                                const pageHeight = pageSize === 'A4' ? (pageConfig.orientation === 'landscape' ? '210mm' : '297mm') : 'min-content';

                                return (
                                    <div
                                        key={index}
                                        style={{
                                            width: pageWidth,
                                            minHeight: pageHeight,
                                            padding: `${pageConfig.margins?.top || 1}in ${pageConfig.margins?.right || 1}in ${pageConfig.margins?.bottom || 1}in ${pageConfig.margins?.left || 1}in`,
                                            transform: `scale(${previewZoom / 100})`,
                                            transformOrigin: 'top center',
                                            marginBottom: `${-100 * (1 - previewZoom / 100)}px`,
                                            boxSizing: 'border-box'
                                        }}
                                        className="bg-white shadow-md border border-gray-200 custom-preview-container prose max-w-none relative overflow-hidden shrink-0 transition-transform duration-200"
                                    >
                                        <div dangerouslySetInnerHTML={{ __html: pageHtml }} className="relative z-10" />

                                        {/* Watermarks Overlay Rendering */}
                                        {watermarks.map(wm => {
                                            const baseStyle: React.CSSProperties = {
                                                position: 'absolute',
                                                color: wm.color,
                                                opacity: wm.opacity,
                                                fontSize: wm.fontSize + 'px',
                                                fontWeight: 'bold',
                                                pointerEvents: 'none',
                                                zIndex: wm.layer === 'foreground' ? 10 : 0,
                                                whiteSpace: 'nowrap',
                                            };

                                            if (wm.position === 'center') {
                                                baseStyle.top = '50%';
                                                baseStyle.left = '50%';
                                                baseStyle.transform = `translate(-50%, -50%) rotate(${wm.rotation ?? -45}deg)`;
                                            } else if (wm.position === 'top-left') {
                                                baseStyle.top = '40px';
                                                baseStyle.left = '40px';
                                                baseStyle.transform = `rotate(${wm.rotation ?? 0}deg)`;
                                            } else if (wm.position === 'bottom-right') {
                                                baseStyle.bottom = '40px';
                                                baseStyle.right = '40px';
                                                baseStyle.transform = `rotate(${wm.rotation ?? 0}deg)`;
                                            } else if (wm.position === 'custom') {
                                                baseStyle.top = `${wm.customY || 50}%`;
                                                baseStyle.left = `${wm.customX || 50}%`;
                                                baseStyle.transform = `translate(-50%, -50%) rotate(${wm.rotation ?? 0}deg)`;
                                            }

                                            if (wm.position === 'tiled') {
                                                return (
                                                    <div key={wm.id} className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: wm.layer === 'foreground' ? 10 : 0, opacity: wm.opacity }}>
                                                        <div className="w-[200%] h-[200%] -ml-[50%] -mt-[50%] flex flex-wrap transform content-start items-start opacity-70" style={{ transform: `rotate(${wm.rotation ?? -45}deg)` }}>
                                                            {Array.from({ length: 150 }).map((_, i) => (
                                                                <div key={i} className="p-8 font-bold" style={{ color: wm.color, fontSize: wm.fontSize + 'px' }}>
                                                                    {wm.type === 'image' && wm.imageUrl ? <img src={wm.imageUrl} style={{ width: wm.fontSize * 5 }} alt="" /> : wm.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={wm.id} style={baseStyle}>
                                                    {wm.type === 'image' && wm.imageUrl ? <img src={wm.imageUrl} style={{ width: wm.fontSize * 5 }} alt="" /> : wm.text}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    // EDITOR VIEW
                    <div className="flex-1 bg-gray-50 overflow-y-auto p-8 relative flex flex-col items-center">
                        <div className="sticky top-4 mb-4 flex gap-1 justify-center z-50 bg-white/40 backdrop-blur-sm hover:bg-white transition-colors duration-300 shadow-md p-1.5 rounded-full border border-gray-100 flex-wrap">
                            {/* Text Styles */}
                            <button onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-2 hover:bg-gray-100 rounded ${editor?.isActive('bold') ? 'bg-gray-100 text-blue-600' : ''}`}><strong>B</strong></button>
                            <button onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-2 hover:bg-gray-100 rounded ${editor?.isActive('italic') ? 'bg-gray-100 text-blue-600' : ''}`}><em>I</em></button>

                            <div className="w-px bg-gray-300 mx-1"></div>

                            {/* Alignment */}
                            <button onClick={() => editor?.chain().focus().setTextAlign('left').run()} className={`p-2 hover:bg-gray-100 rounded ${editor?.isActive({ textAlign: 'left' }) ? 'bg-gray-100 text-blue-600' : ''}`}><AlignLeft size={16} /></button>
                            <button onClick={() => editor?.chain().focus().setTextAlign('center').run()} className={`p-2 hover:bg-gray-100 rounded ${editor?.isActive({ textAlign: 'center' }) ? 'bg-gray-100 text-blue-600' : ''}`}><AlignCenter size={16} /></button>
                            <button onClick={() => editor?.chain().focus().setTextAlign('right').run()} className={`p-2 hover:bg-gray-100 rounded ${editor?.isActive({ textAlign: 'right' }) ? 'bg-gray-100 text-blue-600' : ''}`}><AlignRight size={16} /></button>

                            <div className="w-px bg-gray-300 mx-1"></div>

                            {/* Columns */}
                            <div className="flex items-center group relative">
                                <button className={`p-2 hover:bg-gray-100 rounded flex gap-1 items-center text-sm font-medium ${editor?.isActive('multiColumn') ? 'bg-gray-100 text-blue-600' : 'text-gray-600'}`}><ColumnsIcon size={16} /> Cols</button>
                                <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-col bg-white shadow-lg border border-gray-200 rounded p-1 z-50 min-w-24">
                                    <button onClick={() => editor?.chain().focus().unsetColumns().run()} className="px-3 py-1.5 text-xs text-left hover:bg-gray-50 rounded">1 Column (Reset)</button>
                                    <button onClick={() => editor?.chain().focus().setColumns(2).run()} className="px-3 py-1.5 text-xs text-left hover:bg-gray-50 rounded">2 Columns</button>
                                    <button onClick={() => editor?.chain().focus().setColumns(3).run()} className="px-3 py-1.5 text-xs text-left hover:bg-gray-50 rounded">3 Columns</button>
                                </div>
                            </div>

                            <div className="w-px bg-gray-300 mx-1"></div>

                            {/* Color */}
                            <div className="flex items-center px-2 hover:bg-gray-100 rounded relative group">
                                <PaintBucket size={16} className="text-gray-600 mr-1" />
                                <input
                                    type="color"
                                    onInput={(event) => editor?.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
                                    value={editor?.getAttributes('textStyle').color || '#000000'}
                                    className="w-5 h-5 p-0 border-0 rounded cursor-pointer"
                                />
                            </div>

                            <div className="w-px bg-gray-300 mx-1"></div>

                            {/* Font Size */}
                            <div className="flex items-center px-2 hover:bg-gray-100 rounded">
                                <span className="text-xs text-gray-500 mr-1 font-medium select-none">Size:</span>
                                <input
                                    type="text"
                                    value={fontSizeInput}
                                    onChange={(e) => setFontSizeInput(e.target.value)}
                                    onBlur={() => editor?.commands.setFontSize(fontSizeInput)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            editor?.commands.setFontSize((e.target as HTMLInputElement).value);
                                            editor?.commands.focus();
                                        }
                                    }}
                                    className="w-16 h-7 text-xs border border-gray-200 rounded px-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    placeholder="16px"
                                />
                            </div>

                            <div className="w-px bg-gray-300 mx-1"></div>

                            {/* Image */}
                            <label className="p-2 hover:bg-gray-100 rounded flex gap-1 items-center text-sm font-medium text-gray-600 cursor-pointer">
                                <ImageIcon size={16} /> Image
                                <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                editor?.chain().focus().setImage({ src: reader.result as string }).run();
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                        e.target.value = ''; // Reset input
                                    }}
                                />
                            </label>

                            <div className="w-px bg-gray-300 mx-1"></div>

                            {/* Table */}
                            <button onClick={addTable} className="p-2 hover:bg-gray-100 rounded flex gap-1 items-center text-sm font-medium text-gray-600"><PlusCircle size={16} /> Table</button>

                            {editor?.isActive('table') && (
                                <>
                                    <div className="w-px bg-gray-300 mx-1"></div>
                                    <button onClick={() => toggleBorder('top')} className="px-2 py-1 text-xs hover:bg-gray-100 rounded text-gray-600 font-medium" title="Toggle Top Border">Top</button>
                                    <button onClick={() => toggleBorder('bottom')} className="px-2 py-1 text-xs hover:bg-gray-100 rounded text-gray-600 font-medium" title="Toggle Bottom Border">Bottom</button>
                                    <button onClick={() => toggleBorder('left')} className="px-2 py-1 text-xs hover:bg-gray-100 rounded text-gray-600 font-medium" title="Toggle Left Border">Left</button>
                                    <button onClick={() => toggleBorder('right')} className="px-2 py-1 text-xs hover:bg-gray-100 rounded text-gray-600 font-medium" title="Toggle Right Border">Right</button>
                                </>
                            )}
                        </div>

                        {/* The Editor */}
                        <div onContextMenu={(e) => {
                            if (editor?.isActive('table')) {
                                e.preventDefault();
                                setIsTableMenuOpen(true);
                            }
                        }} className="w-full flex justify-center py-8 relative">
                            {/* Editor Zoom Controls */}
                            <div className="fixed bottom-6 right-[350px] z-[100] bg-white/80 backdrop-blur-md rounded-full shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-3">
                                <span className="text-xs font-medium text-gray-500 w-10">{editorZoom}%</span>
                                <input type="range" min="20" max="200" step="10" value={editorZoom} onChange={(e) => setEditorZoom(parseInt(e.target.value))} className="w-24 accent-blue-600" />
                                <button onClick={() => setEditorZoom(100)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Reset</button>
                            </div>

                            <style>{`
                                .ProseMirror {
                                    width: ${pageSize === 'A4' ? (pageConfig.orientation === 'landscape' ? '297mm' : '210mm') : pageSize === 'A5' ? '148mm' : '8.5in'} !important;
                                    min-height: ${pageSize === 'A4' ? (pageConfig.orientation === 'landscape' ? '210mm' : '297mm') : '11in'} !important;
                                    padding: ${pageConfig.margins?.top || 1}in ${pageConfig.margins?.right || 1}in ${pageConfig.margins?.bottom || 1}in ${pageConfig.margins?.left || 1}in !important;
                                    box-sizing: border-box;
                                    background: white;
                                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                                    position: relative;
                                    z-index: 0;
                                }
                                .ProseMirror .selectedCell {
                                    background-color: rgba(65, 137, 230, 0.2) !important;
                                }
                                
                                body.reveal-behind-images .ProseMirror::after,
                                body.is-dragging-overlay .ProseMirror::after {
                                    content: '';
                                    position: absolute;
                                    left: 0; top: 0; right: 0; bottom: 0;
                                    background: rgba(255, 255, 255, 0.7);
                                    z-index: 50;
                                    pointer-events: none;
                                }
                                
                                body.reveal-behind-images .is-absolute-image,
                                body.is-dragging-overlay .dragging-active {
                                    z-index: 60 !important;
                                }
                            `}</style>
                            <div style={{ transform: `scale(${editorZoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out' }}>
                                <EditorContent editor={editor} />
                            </div>
                        </div>

                        {editor && (
                            <BubbleMenu editor={editor} shouldShow={({ editor }: any) => editor.isActive('table') && isTableMenuOpen}>
                                <div className="bg-gray-800 text-white shadow-lg rounded-md border border-gray-700 p-1 flex items-center gap-1 text-xs">
                                    <button onClick={() => editor.chain().focus().addRowBefore().run()} className="p-1 px-2 hover:bg-gray-700 rounded transition font-medium" title="Add Row Before">↑ Row</button>
                                    <button onClick={() => editor.chain().focus().addRowAfter().run()} className="p-1 px-2 hover:bg-gray-700 rounded transition font-medium" title="Add Row After">↓ Row</button>
                                    <button onClick={() => editor.chain().focus().deleteRow().run()} className="p-1 px-2 hover:bg-red-600 rounded transition text-red-300 font-medium" title="Delete Row">Del Row</button>
                                    <div className="w-px h-4 bg-gray-600 mx-1"></div>
                                    <button onClick={() => editor.chain().focus().addColumnBefore().run()} className="p-1 px-2 hover:bg-gray-700 rounded transition font-medium" title="Add Column Before">← Col</button>
                                    <button onClick={() => editor.chain().focus().addColumnAfter().run()} className="p-1 px-2 hover:bg-gray-700 rounded transition font-medium" title="Add Column After">→ Col</button>
                                    <button onClick={() => editor.chain().focus().deleteColumn().run()} className="p-1 px-2 hover:bg-red-600 rounded transition text-red-300 font-medium" title="Delete Column">Del Col</button>
                                    <div className="w-px h-4 bg-gray-600 mx-1"></div>
                                    <button onClick={() => editor.chain().focus().mergeCells().run()} className="p-1 px-2 hover:bg-gray-700 rounded transition font-medium" title="Merge Cells">Merge</button>
                                    <button onClick={() => editor.chain().focus().splitCell().run()} className="p-1 px-2 hover:bg-gray-700 rounded transition font-medium" title="Split Cell">Split</button>
                                    <div className="w-px h-4 bg-gray-600 mx-1"></div>
                                    <button onClick={() => editor.chain().focus().deleteTable().run()} className="p-1 px-2 hover:bg-red-600 rounded transition text-red-400 font-bold" title="Delete Table">Del Table</button>
                                    <div className="w-px h-4 bg-gray-600 mx-1"></div>
                                    <div className="flex items-center px-2 hover:bg-gray-700 rounded relative group" title="Cell Background Color">
                                        <PaintBucket size={14} className="text-gray-300 mr-1" />
                                        <input
                                            type="color"
                                            onInput={(event) => {
                                                const color = (event.target as HTMLInputElement).value;
                                                editor.chain().focus().updateAttributes('tableCell', { backgroundColor: color }).updateAttributes('tableHeader', { backgroundColor: color }).run();
                                            }}
                                            className="w-4 h-4 p-0 border-0 rounded cursor-pointer bg-transparent"
                                        />
                                    </div>
                                </div>
                            </BubbleMenu>
                        )}
                        {editor && (
                            <BubbleMenu editor={editor} shouldShow={({ editor }: any) => editor.isActive('image') && !isTableMenuOpen}>
                                <div className="bg-gray-800 text-white shadow-lg rounded-md border border-gray-700 p-1 flex items-center gap-1 text-xs">
                                    <span className="px-2 font-medium text-gray-300">Wrap Text:</span>
                                    <button onClick={() => editor.chain().focus().updateAttributes('image', { wrapType: 'inline', x: 0, y: 0 }).run()} className={`p-1 px-2 rounded transition font-medium ${editor.isActive('image', { wrapType: 'inline' }) || !editor.getAttributes('image').wrapType ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>Inline</button>
                                    <button onClick={() => editor.chain().focus().updateAttributes('image', { wrapType: 'square-left', x: 0, y: 0 }).run()} className={`p-1 px-2 rounded transition font-medium ${editor.isActive('image', { wrapType: 'square-left' }) ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>Square Left</button>
                                    <button onClick={() => editor.chain().focus().updateAttributes('image', { wrapType: 'square-right', x: 0, y: 0 }).run()} className={`p-1 px-2 rounded transition font-medium ${editor.isActive('image', { wrapType: 'square-right' }) ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>Square Right</button>
                                    <button onClick={() => editor.chain().focus().updateAttributes('image', { wrapType: 'top-bottom', x: 0, y: 0 }).run()} className={`p-1 px-2 rounded transition font-medium ${editor.isActive('image', { wrapType: 'top-bottom' }) ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>Top & Bottom</button>
                                    <button onClick={() => editor.chain().focus().updateAttributes('image', { wrapType: 'behind' }).run()} className={`p-1 px-2 rounded transition font-medium ${editor.isActive('image', { wrapType: 'behind' }) ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>Behind Text</button>
                                    <button onClick={() => editor.chain().focus().updateAttributes('image', { wrapType: 'front' }).run()} className={`p-1 px-2 rounded transition font-medium ${editor.isActive('image', { wrapType: 'front' }) ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}`}>In Front</button>
                                </div>
                            </BubbleMenu>
                        )}
                    </div>
                )}

                {/* Right Sidebar */}
                <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto">
                    {/* Time Versioning Settings */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-semibold text-gray-700 flex items-center gap-2"><Settings size={18} className="text-gray-500" /> Version Settings</h2>
                            <button onClick={() => setIsTimelineOpen(true)} className="p-1.5 bg-gray-100 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition" title="Open Visual Timeline">
                                <Settings2 size={16} />
                            </button>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-3">
                            <input
                                type="checkbox"
                                checked={isTimeBased}
                                onChange={(e) => setIsTimeBased(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            Time-based Versioning
                        </label>

                        {isTimeBased && (
                            <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-100">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Valid From</label>
                                    <input
                                        type="datetime-local"
                                        value={validFrom}
                                        onChange={(e) => setValidFrom(e.target.value)}
                                        className="w-full text-sm border-gray-200 rounded focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Valid To <span className="text-gray-400 font-normal">(Optional)</span></label>
                                    <input
                                        type="datetime-local"
                                        value={validTo}
                                        onChange={(e) => setValidTo(e.target.value)}
                                        className="w-full text-sm border-gray-200 rounded focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Variables */}
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                        <Type size={18} className="text-gray-500" />
                        <h2 className="font-semibold text-gray-700">Variables</h2>
                    </div>
                    <div className="p-4">
                        <p className="text-xs text-gray-500 mb-4">Click to insert at cursor position</p>
                        <div className="space-y-2">
                            {MOCK_VARIABLES.map(variable => (
                                <div
                                    key={variable.name}
                                    onClick={() => insertVariable(variable.name)}
                                    className="p-3 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center group bg-white"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{variable.label}</div>
                                        <div className="text-xs font-mono text-gray-500">{`{{${variable.name}}}`}</div>
                                    </div>
                                    <PlusCircle size={18} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Advanced Elements */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-semibold text-gray-700 flex items-center gap-2"><LayoutTemplate size={18} className="text-gray-500" /> Logic Control</h2>
                        </div>
                        <div className="space-y-2">
                            <button onClick={() => insertVariable('#each items')} className="w-full text-left p-2 text-sm border border-gray-200 bg-white rounded hover:bg-gray-100 font-mono text-gray-600 cursor-pointer text-xs">Loop (&#123;&#123;#each&#125;&#125;)</button>
                            <button onClick={() => insertVariable('#if condition')} className="w-full text-left p-2 text-sm border border-gray-200 bg-white rounded hover:bg-gray-100 font-mono text-gray-600 cursor-pointer text-xs">If/Else (&#123;&#123;#if&#125;&#125;)</button>
                            <button onClick={() => {
                                const hrHTML = '<hr class="page-break" style="page-break-after: always; border: 0; border-top: 4px dashed #ccc; margin: 40px 0; position: relative;" data-label="--- PAGE BREAK ---" />';
                                editor?.chain().focus().insertContent(hrHTML).run();
                            }} className="w-full text-left p-2 text-sm border border-gray-200 bg-white rounded hover:bg-gray-100 font-mono text-gray-600 cursor-pointer text-xs">Page Break</button>
                            <button onClick={() => openWatermarkModal()} className="w-full flex justify-between items-center p-2 text-sm border border-blue-200 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 font-medium cursor-pointer text-xs">
                                Watermarks <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-[10px]">{watermarks.length}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timline Manager Modal */}
            <VersionTimelineManager
                isOpen={isTimelineOpen}
                onClose={() => setIsTimelineOpen(false)}
                templateCode={templateCode}
                onLoadVersion={loadSpecificVersion}
            />

            {/* Watermarks Modal */}
            {isWatermarkModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800">Manage Watermarks</h3>
                            <button onClick={() => setIsWatermarkModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>

                        <div className="flex-1 flex overflow-hidden">
                            {/* Left side: List */}
                            <div className="w-1/4 border-r border-gray-100 bg-gray-50 flex flex-col p-4 overflow-y-auto shrink-0">
                                <button onClick={() => openWatermarkModal()} className="w-full mb-4 py-2 bg-white border border-dashed border-gray-300 rounded text-blue-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-300 transition">
                                    <PlusCircle size={16} /> New Watermark
                                </button>
                                <div className="space-y-2">
                                    {watermarks.map(wm => (
                                        <div key={wm.id} onClick={() => openWatermarkModal(wm)} className={`p-3 bg-white rounded border shadow-sm cursor-pointer transition ${editingWatermark?.id === wm.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'}`}>
                                            <div className="font-bold text-sm truncate text-gray-800">{wm.text}</div>
                                            <div className="text-xs text-gray-500 flex justify-between mt-1">
                                                <span>{wm.position}</span>
                                                <span className="opacity-50 hover:opacity-100 text-red-600" onClick={(e) => { e.stopPropagation(); deleteWatermark(wm.id); }}><Trash2 size={14} /></span>
                                            </div>
                                        </div>
                                    ))}
                                    {watermarks.length === 0 && <p className="text-xs text-center text-gray-400 italic">No watermarks</p>}
                                </div>
                            </div>

                            {/* Middle side: Editor Options */}
                            <div className="flex-1 p-6 overflow-y-auto bg-white border-r border-gray-100 min-w-[300px]">
                                {editingWatermark ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 mb-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" value="text" checked={editingWatermark.type === 'text'} onChange={() => setEditingWatermark({ ...editingWatermark, type: 'text' })} className="text-blue-600" />
                                                <span className="text-sm font-medium text-gray-700">Text Watermark</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="radio" value="image" checked={editingWatermark.type === 'image'} onChange={() => setEditingWatermark({ ...editingWatermark, type: 'image' })} className="text-blue-600" />
                                                <span className="text-sm font-medium text-gray-700">Image Watermark</span>
                                            </label>
                                        </div>

                                        {editingWatermark.type === 'text' ? (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Watermark Text</label>
                                                <input type="text" value={editingWatermark.text} onChange={e => setEditingWatermark({ ...editingWatermark, text: e.target.value })} className="w-full border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500" />
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image (PNG/JPG)</label>
                                                <input type="file" accept="image/png, image/jpeg" onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => setEditingWatermark({ ...editingWatermark, imageUrl: reader.result as string });
                                                        reader.readAsDataURL(file);
                                                    }
                                                }} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                                                {editingWatermark.imageUrl && <div className="mt-2 h-20 bg-gray-100 rounded flex items-center justify-center p-2 border border-gray-200"><img src={editingWatermark.imageUrl} className="max-h-full max-w-full object-contain" /></div>}
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Opacity: <span className="font-normal text-blue-600">{editingWatermark.opacity}</span></label>
                                                <input type="range" min="0.05" max="1" step="0.05" value={editingWatermark.opacity} onChange={e => setEditingWatermark({ ...editingWatermark, opacity: parseFloat(e.target.value) })} className="w-full accent-blue-600" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Scale / Size: <span className="font-normal text-blue-600">{editingWatermark.fontSize}</span></label>
                                                <input type="range" min="12" max="300" step="2" value={editingWatermark.fontSize} onChange={e => setEditingWatermark({ ...editingWatermark, fontSize: parseInt(e.target.value) })} className="w-full accent-blue-600" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Rotation (deg): <span className="font-normal text-blue-600">{editingWatermark.rotation || 0}°</span></label>
                                                <input type="range" min="-180" max="180" step="5" value={editingWatermark.rotation || 0} onChange={e => setEditingWatermark({ ...editingWatermark, rotation: parseInt(e.target.value) })} className="w-full accent-blue-600" />
                                            </div>
                                            {editingWatermark.type === 'text' && (
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                                                    <input type="color" value={editingWatermark.color} onChange={e => setEditingWatermark({ ...editingWatermark, color: e.target.value })} className="w-full h-10 p-1 border border-gray-300 rounded cursor-pointer" />
                                                </div>
                                            )}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
                                                <select value={editingWatermark.position} onChange={e => setEditingWatermark({ ...editingWatermark, position: e.target.value as any })} className="w-full border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500">
                                                    <option value="center">Center / Diagonal</option>
                                                    <option value="tiled">Background Tiled</option>
                                                    <option value="top-left">Top Left</option>
                                                    <option value="bottom-right">Bottom Right</option>
                                                    <option value="custom">Custom (Drag & Drop)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Layer Depth</label>
                                                <select value={editingWatermark.layer} onChange={e => setEditingWatermark({ ...editingWatermark, layer: e.target.value as any })} className="w-full border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500">
                                                    <option value="background">Behind Text (Background)</option>
                                                    <option value="foreground">In Front of Text</option>
                                                </select>
                                            </div>
                                        </div>
                                        {editingWatermark.position === 'custom' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Custom Position Coordinates</label>
                                                <div className="flex gap-4 items-center border border-gray-100 bg-gray-50/50 p-4 rounded-md">
                                                    <div
                                                        className="relative bg-white border-2 border-dashed border-gray-300 shadow-sm cursor-crosshair overflow-hidden"
                                                        style={{ width: '120px', height: pageSize === 'A5' ? '85px' : '170px' }}
                                                        onMouseDown={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const updatePos = (clientX: number, clientY: number) => {
                                                                const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
                                                                const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
                                                                setEditingWatermark(prev => prev ? { ...prev, customX: x, customY: y } : null);
                                                            };
                                                            updatePos(e.clientX, e.clientY);

                                                            const handleMouseMove = (moveEvent: MouseEvent) => {
                                                                updatePos(moveEvent.clientX, moveEvent.clientY);
                                                            };

                                                            const handleMouseUp = () => {
                                                                window.removeEventListener('mousemove', handleMouseMove);
                                                                window.removeEventListener('mouseup', handleMouseUp);
                                                            };

                                                            window.addEventListener('mousemove', handleMouseMove);
                                                            window.addEventListener('mouseup', handleMouseUp);
                                                        }}
                                                    >
                                                        <div
                                                            className="absolute w-3 h-3 bg-blue-600 rounded-full shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none ring-2 ring-white"
                                                            style={{ left: `${editingWatermark.customX || 50}%`, top: `${editingWatermark.customY || 50}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-gray-600 space-y-2">
                                                        <p>Click and drag inside the miniature canvas to set exact target placement.</p>
                                                        <div className="flex gap-2">
                                                            <div className="bg-white px-3 py-1.5 border rounded-md shadow-sm min-w-[70px] text-center font-mono">X: {Math.round(editingWatermark.customX || 50)}%</div>
                                                            <div className="bg-white px-3 py-1.5 border rounded-md shadow-sm min-w-[70px] text-center font-mono">Y: {Math.round(editingWatermark.customY || 50)}%</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Condition Variable <span className="text-gray-400 font-normal text-xs">(optional, e.g. "mark" for data.mark)</span></label>
                                            <input type="text" placeholder="Leave empty to always show" value={editingWatermark.conditionVariable || ''} onChange={e => setEditingWatermark({ ...editingWatermark, conditionVariable: e.target.value })} className="w-full border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500 placeholder-gray-300 mb-4" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Page Range <span className="text-gray-400 font-normal text-xs">(optional, e.g. "1-3, 5")</span></label>
                                            <input type="text" placeholder="Leave empty for all pages" value={editingWatermark.pages} onChange={e => setEditingWatermark({ ...editingWatermark, pages: e.target.value })} className="w-full border-gray-300 rounded focus:border-blue-500 focus:ring-blue-500 placeholder-gray-300" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                        Select or create a watermark to edit
                                    </div>
                                )}
                            </div>

                            {/* Right side: Live WYSIWYG Preview */}
                            <div className="w-[300px] bg-gray-100 flex flex-col items-center justify-start overflow-y-auto shrink-0 py-8 px-4 border-l border-gray-200 shadow-inner">
                                <h4 className="text-gray-500 font-medium mb-6 flex items-center gap-2"><LayoutTemplate size={16} /> Live Layout Preview</h4>
                                {editingWatermark ? (
                                    <div className="bg-white shadow-md rounded relative overflow-hidden flex-shrink-0" style={{ width: '210px', height: '297px' }}>
                                        {/* Document Fake Lines */}
                                        <div className="absolute inset-x-4 top-8 space-y-3 opacity-30 z-0 pointer-events-none">
                                            <div className="h-2 bg-gray-300 rounded w-3/4"></div>
                                            <div className="h-2 bg-gray-300 rounded w-full"></div>
                                            <div className="h-2 bg-gray-300 rounded w-5/6"></div>
                                            <div className="h-2 bg-gray-300 rounded w-full"></div>
                                            <div className="h-2 bg-gray-300 rounded w-2/3"></div>
                                        </div>
                                        {/* Scale ratio factor from A4 real width 210mm (approx 794px) to 210px preview width = roughly 1/3.78 scale */}
                                        {(() => {
                                            const wm = editingWatermark;
                                            const scaleFactor = 210 / 800; // approximate scaling ratio

                                            const baseStyle: React.CSSProperties = {
                                                position: 'absolute',
                                                color: wm.color,
                                                opacity: wm.opacity,
                                                fontSize: (wm.fontSize * scaleFactor) + 'px',
                                                fontWeight: 'bold',
                                                pointerEvents: 'none',
                                                zIndex: wm.layer === 'foreground' ? 10 : 0,
                                                whiteSpace: 'nowrap',
                                            };

                                            if (wm.position === 'center') {
                                                baseStyle.top = '50%';
                                                baseStyle.left = '50%';
                                                baseStyle.transform = `translate(-50%, -50%) rotate(${wm.rotation ?? -45}deg)`;
                                            } else if (wm.position === 'top-left') {
                                                baseStyle.top = '10px';
                                                baseStyle.left = '10px';
                                                baseStyle.transform = `rotate(${wm.rotation ?? 0}deg)`;
                                            } else if (wm.position === 'bottom-right') {
                                                baseStyle.bottom = '10px';
                                                baseStyle.right = '10px';
                                                baseStyle.transform = `rotate(${wm.rotation ?? 0}deg)`;
                                            } else if (wm.position === 'custom') {
                                                baseStyle.top = `${wm.customY || 50}%`;
                                                baseStyle.left = `${wm.customX || 50}%`;
                                                baseStyle.transform = `translate(-50%, -50%) rotate(${wm.rotation ?? 0}deg)`;
                                            }

                                            if (wm.position === 'tiled') {
                                                return (
                                                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" style={{ opacity: wm.opacity }}>
                                                        <div className="w-[200%] h-[200%] -ml-[50%] -mt-[50%] flex flex-wrap transform content-start items-start opacity-70" style={{ transform: `rotate(${wm.rotation ?? -45}deg)` }}>
                                                            {Array.from({ length: 50 }).map((_, i) => (
                                                                <div key={i} className="p-2 font-bold" style={{ color: wm.color, fontSize: (wm.fontSize * scaleFactor) + 'px' }}>
                                                                    {wm.type === 'image' ? (wm.imageUrl ? <img src={wm.imageUrl} style={{ width: (wm.fontSize * 5 * scaleFactor) + 'px' }} /> : null) : wm.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div style={baseStyle}>
                                                    {wm.type === 'image' ? (wm.imageUrl ? <img src={wm.imageUrl} style={{ width: (wm.fontSize * 5 * scaleFactor) + 'px' }} /> : null) : wm.text}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center text-gray-400 mt-20 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                                        <div className="w-16 h-20 bg-gray-200 border border-gray-300 rounded mb-3 flex items-center justify-center relative overflow-hidden">
                                            <span className="absolute transform -rotate-45 text-[8px] font-bold text-gray-300 border-2 border-gray-300 p-0.5 rounded-sm">NONE</span>
                                        </div>
                                        <p className="text-xs">No active watermark selected for preview.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
                            <button onClick={() => setIsWatermarkModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 bg-white hover:bg-gray-50 transition">Done</button>
                            <button onClick={saveWatermark} disabled={!editingWatermark} className={`px-4 py-2 rounded text-white transition ${editingWatermark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}>Save Edit</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Curling Modal */}
            {isCurlModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-[800px] overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Terminal size={20} className="text-gray-700" /> Code Snippet: Lấy báo cáo PDF</h3>
                                <p className="text-xs text-gray-500 mt-1">Sử dụng cURL này để gọi API tạo PDF bằng mẫu <strong>{templateCode || 'TEMPlATE_CODE'}</strong>.</p>
                            </div>
                            <button onClick={() => setIsCurlModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition"><X size={20} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto w-full">
                            <pre className="bg-gray-900 text-green-400 p-4 rounded-md overflow-x-auto text-sm font-mono leading-[1.6]">
                                {`curl -X POST http://localhost:3000/api/generate-document \\
  -H "Content-Type: application/json" \\
  -H "x-app-code: <YOUR_APP_CODE>" \\
  -H "x-app-secret: <YOUR_APP_SECRET>" \\${currentVersionNumber ? `\n  -H "x-template-version: ${currentVersionNumber}" \\` : ''}
  -d '{
    "template_code": "${templateCode || 'TEMPLATE_CODE'}",
    "data": ${previewJson.replace(/\n/g, '\n    ')}
  }' \\
  --output report.pdf`}
                            </pre>
                            <div className="mt-4 text-sm text-gray-600 bg-blue-50 p-4 rounded border border-blue-100 leading-relaxed">
                                <strong>Lưu ý:</strong> Thay thế <code>&lt;YOUR_APP_CODE&gt;</code> và <code>&lt;YOUR_APP_SECRET&gt;</code> bằng khóa App Code và API Secret của Workspace bạn trong tab <span className="font-semibold text-gray-800">App Clients</span>.<br />
                                {currentVersionNumber ? <span className="text-indigo-700 mt-2 block font-medium">Lệnh này có Header <code>x-template-version: {currentVersionNumber}</code> nên sẽ ép server tải chính xác phiên bản mà bạn đang xem này (v{currentVersionNumber}). Xoá dòng Header này đi nếu bạn muốn Server tự tính toán lấy bản Version mới nhất tại thời điểm được gọi.</span> : <span className="text-green-700 mt-2 block font-medium">Lệnh này chưa điền Header ép verison, Server sẽ tự động cân nhắc ngày giờ gửi yêu cầu để tự động phân luồng Version chuẩn xác nhất!</span>}
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0 gap-3">
                            {isAdmin && (
                                <button onClick={handleDownloadDemoHTML} className="bg-orange-600 text-white px-5 py-2 rounded shadow-sm hover:bg-orange-700 transition font-medium">Tải HTML Thuần</button>
                            )}
                            <button onClick={handleDownloadDemoPDF} className="bg-indigo-600 text-white px-5 py-2 rounded shadow-sm hover:bg-indigo-700 transition font-medium">Tải trực tiếp PDF</button>
                            <button onClick={() => {
                                navigator.clipboard.writeText(`curl -X POST http://localhost:3000/api/generate-document -H "Content-Type: application/json" -H "x-app-code: <YOUR_APP_CODE>" -H "x-app-secret: <YOUR_APP_SECRET>" ${currentVersionNumber ? `-H "x-template-version: ${currentVersionNumber}" ` : ''}-d '{"template_code": "${templateCode || 'TEMPLATE_CODE'}", "data": ${previewJson.replace(/\n/g, '')}}' --output report.pdf`);
                                toast.success("Đã copy mã cURL vào clipboard");
                            }} className="bg-gray-800 text-white px-5 py-2 rounded shadow-sm hover:bg-gray-700 transition font-medium">Copy API Code</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TemplateBuilder;
