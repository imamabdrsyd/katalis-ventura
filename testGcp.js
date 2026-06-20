const text = "Ini dia: https://res.cloudinary.com/demo/image/upload/v123/img.jpg. Silakan dicek!";
const urls = text.match(/https:\/\/res\.cloudinary\.com\/[^\s)\]"']+/g) || [];
const cleanUrls = urls.map(url => url.replace(/[.,!?]+$/, ''));
console.log(cleanUrls);
