'use client';

import { useRef, useState } from 'react';
import {
  Camera, ImageIcon, Loader2, X, Search,
  ShoppingBag, ShoppingCart, Store, Package, Tag, Gift, Truck, Boxes,
  Utensils, Coffee, UtensilsCrossed, Pizza, Salad,
  Scissors, Sparkles, Heart, Star, Smile,
  Home, Building2, Hotel, MapPin, Key,
  Briefcase, Users, UserCheck, Handshake, Award, Trophy,
  Phone, MessageCircle, MessageSquare, Mail, Globe, Link2, Share2, Send, AtSign,
  Camera as CameraIcon, Image, Video, Mic, Music, Palette,
  Leaf, Flower2, Sun, Zap, Flame, Droplets,
  BookOpen, GraduationCap, Lightbulb, PenLine,
  Car, Bike, Plane, Anchor,
  Dumbbell, Activity, Stethoscope,
  CreditCard, DollarSign, PiggyBank, BarChart2,
  Instagram, Linkedin, Twitter, Youtube, Facebook, Github, Twitch,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { OmniChannelLink, OmniChannelType } from '@/types';
import { addOmniChannelLink, updateOmniChannelLink } from '@/lib/api/omniChannel';
import { CHANNEL_META, CHANNEL_CATEGORIES, getChannelsByCategory } from '@/lib/omniChannelMeta';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  businessId: string;
  nextSortOrder: number;
  editingLink?: OmniChannelLink;
  onClose: () => void;
  onSaved: () => void;
}

// Daftar icon Lucide bertema bisnis — labelnya ada di kamus i18n
// (`omniLink.icons`, dikunci nama icon) karena konstanta modul-level tak bisa
// memanggil hook. Label dipakai dua kali: teks di bawah icon dan kata kunci pencarian.
const LUCIDE_ICONS: { name: string; Icon: React.ElementType }[] = [
  { name: 'ShoppingBag', Icon: ShoppingBag },
  { name: 'ShoppingCart', Icon: ShoppingCart },
  { name: 'Store', Icon: Store },
  { name: 'Package', Icon: Package },
  { name: 'Tag', Icon: Tag },
  { name: 'Gift', Icon: Gift },
  { name: 'Truck', Icon: Truck },
  { name: 'Boxes', Icon: Boxes },
  { name: 'Utensils', Icon: Utensils },
  { name: 'Coffee', Icon: Coffee },
  { name: 'UtensilsCrossed', Icon: UtensilsCrossed },
  { name: 'Pizza', Icon: Pizza },
  { name: 'Salad', Icon: Salad },
  { name: 'Scissors', Icon: Scissors },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Heart', Icon: Heart },
  { name: 'Star', Icon: Star },
  { name: 'Smile', Icon: Smile },
  { name: 'Home', Icon: Home },
  { name: 'Building2', Icon: Building2 },
  { name: 'Hotel', Icon: Hotel },
  { name: 'MapPin', Icon: MapPin },
  { name: 'Key', Icon: Key },
  { name: 'Briefcase', Icon: Briefcase },
  { name: 'Users', Icon: Users },
  { name: 'UserCheck', Icon: UserCheck },
  { name: 'Handshake', Icon: Handshake },
  { name: 'Award', Icon: Award },
  { name: 'Trophy', Icon: Trophy },
  { name: 'Instagram', Icon: Instagram },
  { name: 'Facebook', Icon: Facebook },
  { name: 'Twitter', Icon: Twitter },
  { name: 'Youtube', Icon: Youtube },
  { name: 'Linkedin', Icon: Linkedin },
  { name: 'Github', Icon: Github },
  { name: 'Twitch', Icon: Twitch },
  { name: 'Phone', Icon: Phone },
  { name: 'MessageCircle', Icon: MessageCircle },
  { name: 'MessageSquare', Icon: MessageSquare },
  { name: 'Send', Icon: Send },
  { name: 'AtSign', Icon: AtSign },
  { name: 'Mail', Icon: Mail },
  { name: 'Globe', Icon: Globe },
  { name: 'Link2', Icon: Link2 },
  { name: 'Share2', Icon: Share2 },
  { name: 'Camera', Icon: CameraIcon },
  { name: 'Image', Icon: Image },
  { name: 'Video', Icon: Video },
  { name: 'Mic', Icon: Mic },
  { name: 'Music', Icon: Music },
  { name: 'Palette', Icon: Palette },
  { name: 'Leaf', Icon: Leaf },
  { name: 'Flower2', Icon: Flower2 },
  { name: 'Sun', Icon: Sun },
  { name: 'Zap', Icon: Zap },
  { name: 'Flame', Icon: Flame },
  { name: 'Droplets', Icon: Droplets },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'GraduationCap', Icon: GraduationCap },
  { name: 'Lightbulb', Icon: Lightbulb },
  { name: 'PenLine', Icon: PenLine },
  { name: 'Car', Icon: Car },
  { name: 'Bike', Icon: Bike },
  { name: 'Plane', Icon: Plane },
  { name: 'Anchor', Icon: Anchor },
  { name: 'Dumbbell', Icon: Dumbbell },
  { name: 'Activity', Icon: Activity },
  { name: 'Stethoscope', Icon: Stethoscope },
  { name: 'CreditCard', Icon: CreditCard },
  { name: 'DollarSign', Icon: DollarSign },
  { name: 'PiggyBank', Icon: PiggyBank },
  { name: 'BarChart2', Icon: BarChart2 },
];

function IconPickerModal({
  selected,
  onSelect,
  onClose,
}: {
  selected: string | null;
  onSelect: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const iconLabel = (name: string) => t.omniLink.icons[name] ?? name;
  const filtered = query.trim()
    ? LUCIDE_ICONS.filter((i) =>
        iconLabel(i.name).toLowerCase().includes(query.toLowerCase()) ||
        i.name.toLowerCase().includes(query.toLowerCase())
      )
    : LUCIDE_ICONS;

  return (
    <Modal isOpen={true} onClose={onClose} title={t.omniLink.iconPickerTitle}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.omniLink.iconSearchPlaceholder}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => { onSelect(name); onClose(); }}
              title={iconLabel(name)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${
                selected === name
                  ? 'bg-primary-50 dark:bg-primary-900/25 ring-1 ring-primary-300 dark:ring-primary-600'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className={`w-5 h-5 ${selected === name ? 'text-primary-500' : 'text-gray-600 dark:text-gray-300'}`} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate w-full text-center">{iconLabel(name)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-5 text-center text-sm text-gray-400 py-6">{t.omniLink.iconNoMatch}</p>
          )}
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => { onSelect(''); onClose(); }}
            className="w-full text-xs text-gray-400 hover:text-red-500 transition-colors text-center py-1"
          >
            {t.omniLink.iconClear}
          </button>
        )}
      </div>
    </Modal>
  );
}

export function AddOmniChannelLinkModal({ businessId, nextSortOrder, editingLink, onClose, onSaved }: Props) {
  const { t } = useLanguage();
  const [channelType, setChannelType] = useState<OmniChannelType>(editingLink?.channel_type ?? 'instagram');
  const [label, setLabel] = useState(editingLink?.label ?? CHANNEL_META.instagram.defaultLabel);
  const [subtitle, setSubtitle] = useState(editingLink?.subtitle ?? '');
  const [url, setUrl] = useState(editingLink?.url ?? '');
  const [isActive, setIsActive] = useState(editingLink?.is_active ?? true);
  const [displayMode, setDisplayMode] = useState<'default' | 'icon_only'>(editingLink?.display_mode ?? 'default');
  const [customIconUrl, setCustomIconUrl] = useState(editingLink?.custom_icon_url ?? '');
  const [lucideIcon, setLucideIcon] = useState<string>(editingLink?.lucide_icon ?? '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconError, setIconError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const iconInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingLink;

  const handleTypeChange = (type: OmniChannelType) => {
    setChannelType(type);
    if (!isEditing) {
      setLabel(type === 'custom' ? '' : CHANNEL_META[type].defaultLabel);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setIconError(t.omniLink.imageOnly);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setIconError(t.omniLink.maxFileSize.replace('{size}', '2MB'));
      return;
    }
    if (!isEditing) {
      setIconError(t.omniLink.iconSaveFirst);
      return;
    }
    setUploadingIcon(true);
    setIconError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/omni-channel/links/${editingLink.id}/icon`, {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t.omniLink.iconUploadFailed);
      setCustomIconUrl(json.url);
      setLucideIcon(''); // clear lucide if custom image uploaded
    } catch (err: any) {
      setIconError(err.message || t.omniLink.iconUploadFailed);
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) iconInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!url.trim()) { setError(t.omniLink.urlRequired); return; }
    if (!label.trim()) { setError(t.omniLink.labelRequired); return; }

    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await updateOmniChannelLink(editingLink.id, {
          channel_type: channelType,
          label: label.trim(),
          subtitle: subtitle.trim() || null,
          url: normalizedUrl,
          is_active: isActive,
          custom_icon_url: customIconUrl || null,
          lucide_icon: lucideIcon || null,
          display_mode: displayMode,
        });
      } else {
        await addOmniChannelLink('', {
          channel_type: channelType,
          label: label.trim(),
          subtitle: subtitle.trim() || null,
          url: normalizedUrl,
          is_active: isActive,
          is_primary: false,
          sort_order: nextSortOrder,
          lucide_icon: lucideIcon || null,
          display_mode: displayMode,
          businessId,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || t.omniLink.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const meta = CHANNEL_META[channelType];

  // `omniChannelMeta.ts` sengaja dibiarkan data murni (dipakai juga oleh halaman
  // publik), jadi label chrome-nya diterjemahkan di sini.
  const CATEGORY_LABEL: Record<string, string> = {
    social: t.omniLink.categorySocial,
    ecommerce: t.omniLink.categoryEcommerce,
    messaging: t.omniLink.categoryMessaging,
    custom: t.omniLink.categoryCustom,
  };

  // Lucide icon component untuk preview
  const SelectedLucideIcon = lucideIcon
    ? LUCIDE_ICONS.find((i) => i.name === lucideIcon)?.Icon
    : null;

  return (
    <>
      {showIconPicker && (
        <IconPickerModal
          selected={lucideIcon}
          onSelect={(name) => {
            setLucideIcon(name);
            if (name) setCustomIconUrl(''); // clear uploaded image if lucide selected
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}

      <Modal isOpen={true} onClose={onClose} title={isEditing ? t.omniLink.editTitle : t.omniLink.addTitle}>
        <div className="space-y-4">
          {/* Channel Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.omniLink.channelType}
            </label>
            <div className="space-y-3">
              {CHANNEL_CATEGORIES.map((cat) => {
                const channels = getChannelsByCategory(cat.key);
                return (
                  <div key={cat.key}>
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
                      {CATEGORY_LABEL[cat.key] ?? cat.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {channels.map(({ type, meta: m }) => (
                        <button
                          key={type}
                          onClick={() => handleTypeChange(type)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            channelType === type
                              ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-500 dark:text-primary-300 ring-1 ring-primary-300 dark:ring-primary-500'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {type === 'custom' ? t.omniLink.customChannel : m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.omniLink.labelField}{channelType === 'custom' && <span className="text-red-400 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={channelType === 'custom' ? t.omniLink.labelCustomPlaceholder : meta.defaultLabel}
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {channelType === 'custom' && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t.omniLink.labelCustomHint}
              </p>
            )}
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.omniLink.subtitleField} <span className="text-gray-400 font-normal">({t.common.optional})</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder={t.omniLink.subtitlePlaceholder}
              maxLength={200}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t.omniLink.subtitleHint}
            </p>
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.omniLink.urlField}
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={meta.placeholder}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Icon — Lucide picker + custom upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.omniLink.iconField} <span className="text-gray-400 font-normal">({t.common.optional})</span>
            </label>
            <div className="flex items-center gap-3">
              {/* Preview area */}
              <div className="relative group shrink-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  {customIconUrl ? (
                    <img src={customIconUrl} alt="Icon" className="w-full h-full object-cover" />
                  ) : SelectedLucideIcon ? (
                    <SelectedLucideIcon className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                {/* Upload overlay */}
                <label className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl cursor-pointer transition-opacity ${uploadingIcon ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {uploadingIcon ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                  <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconUpload} disabled={uploadingIcon || !isEditing} className="hidden" />
                </label>
                {(customIconUrl || lucideIcon) && !uploadingIcon && (
                  <button
                    type="button"
                    onClick={() => { setCustomIconUrl(''); setLucideIcon(''); setIconError(''); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex-1 min-w-0 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                >
                  <Search className="w-3.5 h-3.5 text-gray-400" />
                  {lucideIcon
                    ? t.omniLink.icons[lucideIcon] ?? lucideIcon
                    : t.omniLink.iconPick}
                </button>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {isEditing ? t.omniLink.iconUploadHint : t.omniLink.iconSaveFirst}
                </p>
                {iconError && <p className="text-xs text-red-500">{iconError}</p>}
              </div>
            </div>
          </div>

          {/* Display mode */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{t.omniLink.displayIconOnly}</span>
              <p className="text-xs text-gray-400 dark:text-gray-500">{t.omniLink.displayIconOnlyHint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={displayMode === 'icon_only'}
              onClick={() => setDisplayMode(displayMode === 'icon_only' ? 'default' : 'icon_only')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                displayMode === 'icon_only' ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${displayMode === 'icon_only' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">{t.omniLink.activeToggle}</span>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? 'bg-gray-900 dark:bg-gray-100' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-ghost flex-1">{t.common.cancel}</button>
            <button
              onClick={handleSave}
              disabled={saving || !url.trim() || !label.trim()}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t.common.saving}</>
              ) : isEditing ? t.common.save : t.common.add}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
