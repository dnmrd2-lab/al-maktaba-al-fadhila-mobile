from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import math

ROOT = Path('/home/ubuntu/al-maktaba-al-fadhila-mobile')
OUT = ROOT / 'tutorial_frames'
OUT.mkdir(exist_ok=True)
W, H = 720, 1280
GREEN = '#103629'
GREEN2 = '#174838'
CREAM = '#F7F4E9'
WHITE = '#FFFEFA'
GOLD = '#C9A75A'
INK = '#172923'
MUTED = '#748078'
PALE = '#E9E2CD'
FONT_REG = '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf'
LOGO = Image.open(ROOT / 'assets/images/icon.png').convert('RGB')

def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size, layout_engine=ImageFont.Layout.RAQM)

def t(draw, xy, text, size=28, color=INK, bold=False, anchor='mm', align='center'):
    draw.text(xy, text, font=font(size,bold), fill=color, anchor=anchor, align=align, direction='rtl', language='ar', spacing=8)

def roundrect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def base(index, eyebrow, headline, subtitle):
    im = Image.new('RGB',(W,H),GREEN)
    d = ImageDraw.Draw(im)
    # Quiet geometric corner ornaments
    d.ellipse((550,-180,850,120), outline='#285241', width=2)
    d.ellipse((-170,1090,180,1440), outline='#285241', width=2)
    # Logo and branding
    logo = LOGO.resize((86,86),Image.Resampling.LANCZOS)
    mask = Image.new('L',logo.size,0); ImageDraw.Draw(mask).rounded_rectangle((0,0,85,85),radius=22,fill=255)
    im.paste(logo,(48,54),mask)
    t(d,(601,82),'مكتبة فضيلة',25,CREAM,True,'ra')
    t(d,(601,120),'إرشادات إدارة الكتب',17,'#D7CBA7',False,'ra')
    roundrect(d,(48,177,672,250),24,GREEN2,outline='#2D5B46',width=2)
    t(d,(360,213),eyebrow,20,GOLD,True)
    t(d,(360,311),headline,40,CREAM,True)
    t(d,(360,374),subtitle,21,'#D8E2D9',False)
    # progress
    roundrect(d,(48,1208,672,1217),5,'#244A3A')
    roundrect(d,(48,1208,48+int(624*index/6),1217),5,GOLD)
    t(d,(360,1164),f'المشهد {index} من ستة',16,'#C9D8CF',False)
    return im,d

def card(draw, y1=430,y2=1085):
    roundrect(draw,(48,y1,672,y2),32,CREAM)

def pill(draw, x,y,w,label, fill='#E9E2CD', color=GREEN):
    roundrect(draw,(x-w//2,y-27,x+w//2,y+27),22,fill)
    t(draw,(x,y),label,19,color,True)

def screen_top(draw, y, title):
    roundrect(draw,(78,y,642,y+80),20,GREEN)
    t(draw,(610,y+40),title,24,CREAM,True,'ra')
    # simple line icon book
    draw.rounded_rectangle((98,y+25,137,y+55),radius=5,outline=GOLD,width=3)
    draw.line((117,y+27,117,y+53),fill=GOLD,width=2)

# Scene 1: intro / prerequisite
im,d=base(1,'قبل ما تبدأ','إضافة كتاب للمكتبة','من ملف الكتاب إلى نشره للقراء')
card(d,440,1086)
screen_top(d,475,'إدارة المكتبة')
roundrect(d,(92,590,628,784),24,WHITE,outline='#DED7C4',width=2)
t(d,(360,642),'تأكد من اتصال قاعدة البيانات',25,INK,True)
t(d,(360,696),'الصحيحة',24,GREEN,True)
t(d,(360,747),'ومخزن الملفات والصلاحيات',20,MUTED)
# checkmarks
d.ellipse((319,811,401,893),fill='#E6F0E8')
d.line((342,852,355,865),fill=GREEN,width=7)
d.line((355,865,380,834),fill=GREEN,width=7)
t(d,(360,944),'بعد الإعداد، سجّل دخولك',26,INK,True)
t(d,(360,1000),'بحساب فريق مخوّل',21,MUTED)
im.save(OUT/'scene-01.png')

# Scene 2: login
im,d=base(2,'الخطوة ١','دخول الإدارة','استخدم حساباً معتمداً لفريق المكتبة')
card(d)
screen_top(d,466,'دخول الإدارة')
t(d,(600,604),'البريد الإلكتروني',19,MUTED,True,'ra')
roundrect(d,(96,625,624,683),15,WHITE,outline='#D9D2BF',width=2)
t(d,(590,655),'البريد المسجل',17,'#9A9F97',False,'ra')
t(d,(600,727),'كلمة المرور',19,MUTED,True,'ra')
roundrect(d,(96,748,624,806),15,WHITE,outline='#D9D2BF',width=2)
t(d,(590,777),'أدخل كلمة المرور',17,'#9A9F97',False,'ra')
roundrect(d,(96,840,624,913),22,GREEN)
t(d,(360,877),'تسجيل الدخول',23,CREAM,True)
t(d,(360,968),'الصلاحية المطلوبة للإضافة',20,INK,True)
pill(d,490,1024,230,'مسؤول محتوى')
pill(d,245,1024,170,'مدير')
im.save(OUT/'scene-02.png')

# Scene 3: metadata form
im,d=base(3,'الخطوة ٢','اكتب بيانات الكتاب','العنوان والمجلد مطلوبان، والباقي اختياري')
card(d,430,1090)
screen_top(d,456,'إضافة كتاب')
fields=[('عنوان الكتاب *','شرح كتاب في العقيدة'),('المؤلف','اسم المؤلف'),('التصنيف','العقيدة، الفقه…'),('الوصف','نبذة مختصرة'),('عدد الصفحات','اختياري')]
y=565
for label,placeholder in fields:
    t(d,(602,y),label,17,MUTED,True,'ra')
    roundrect(d,(95,y+14,625,y+62),12,WHITE,outline='#D9D2BF',width=1)
    t(d,(600,y+38),placeholder,16,'#92998F',False,'ra')
    y += 96
roundrect(d,(96,1040,624,1080),14,'#E7EEDF')
t(d,(360,1060),'اختار المجلد المناسب',16,GREEN,True)
im.save(OUT/'scene-03.png')

# Scene 4: select PDF and save draft
im,d=base(4,'الخطوة ٣','اختار ملف الكتاب','ارفع نسخة الكتاب من جهازك')
card(d)
screen_top(d,466,'ملف الكتاب')
roundrect(d,(95,600,625,784),24,WHITE,outline='#D9D2BF',width=2)
# document glyph
d.rounded_rectangle((310,625,410,740),radius=10,outline=GREEN,width=5)
d.line((335,668,385,668),fill=GOLD,width=4)
d.line((335,690,385,690),fill=GOLD,width=4)
d.line((335,712,375,712),fill=GOLD,width=4)
t(d,(360,758),'اختر ملف الكتاب',20,GREEN,True)
roundrect(d,(96,828,624,912),22,GREEN)
t(d,(360,870),'حفظ كمسودة',24,CREAM,True)
roundrect(d,(93,942,627,1057),20,'#F0E8D2')
t(d,(360,980),'المسودة لا تظهر للقراء',22,'#745719',True)
t(d,(360,1024),'حتى تنشرها بصلاحية مناسبة',17,'#745719')
im.save(OUT/'scene-04.png')

# Scene 5: publish / unpublish nuance
im,d=base(5,'الخطوة ٤','انشر الكتاب للقراء','يحتاج النشر إلى مدير أو مسؤول نشر')
card(d)
screen_top(d,466,'قائمة الكتب')
roundrect(d,(88,590,632,724),22,WHITE,outline='#D9D2BF',width=2)
t(d,(595,630),'شرح كتاب في العقيدة',21,INK,True,'ra')
pill(d,180,681,140,'مسودة','#F1E6C9','#725716')
roundrect(d,(96,760,624,836),22,GREEN)
t(d,(360,798),'نشر',24,CREAM,True)
# after publish status
roundrect(d,(96,865,624,930),18,'#E3EFE4')
t(d,(360,898),'بعد النشر: يظهر في المكتبة',19,GREEN,True)
roundrect(d,(96,956,624,1044),18,'#F0E8D2')
t(d,(360,986),'إلغاء النشر يوقف العرض فقط',19,'#745719',True)
t(d,(360,1020),'ولا يعني حذف الكتاب نهائياً',17,'#745719')
im.save(OUT/'scene-05.png')

# Scene 6: closing security reminder
im,d=base(6,'معلومة مهمة','حافظ على أمان المكتبة','تأكد من الإعدادات قبل رفع أي كتاب')
card(d,440,1086)
screen_top(d,475,'تنبيه أمان')
# simple drawn lock
roundrect(d,(292,650,428,774),26,GREEN)
d.arc((316,600,404,700),180,360,fill=GOLD,width=12)
d.ellipse((350,695,370,715),fill=GOLD)
d.rounded_rectangle((356,710,364,744),radius=4,fill=GOLD)
t(d,(360,850),'لا تضع مفتاح الخدمة',27,INK,True)
t(d,(360,900),'داخل تطبيق الهاتف',23,GREEN,True)
roundrect(d,(100,963,620,1040),20,'#E7EEDF')
t(d,(360,1001),'تأكد من اتصال قاعدة المكتبة',21,GREEN,True)
im.save(OUT/'scene-06.png')
print('\n'.join(str(p) for p in sorted(OUT.glob('scene-*.png'))))
