use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoInfo {
    pub id: String,
    pub path: String,
    pub filename: String,
    pub width: u32,
    pub height: u32,
}

fn is_image_file(path: &Path) -> bool {
    if let Some(ext) = path.extension() {
        let ext = ext.to_string_lossy().to_lowercase();
        matches!(
            ext.as_str(),
            "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "tiff" | "tif" | "heic"
        )
    } else {
        false
    }
}

fn apply_orientation(img: image::DynamicImage, img_path: &str) -> image::DynamicImage {
    let file = match std::fs::File::open(img_path) {
        Ok(f) => f,
        Err(_) => return img,
    };

    let mut reader = std::io::BufReader::new(file);
    let exifreader = exif::Reader::new();
    let exif = match exifreader.read_from_container(&mut reader) {
        Ok(e) => e,
        Err(_) => return img,
    };

    if let Some(field) = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY) {
        let orientation = match field.value.get_uint(0) {
            Some(v) => v,
            None => return img,
        };

        match orientation {
            3 => img.rotate180(),
            6 => img.rotate90(),
            8 => img.rotate270(),
            2 => img.fliph(),
            4 => img.flipv(),
            5 => img.rotate90().fliph(),
            7 => img.rotate270().fliph(),
            _ => img,
        }
    } else {
        img
    }
}

fn create_thumbnail(img_path: &str, max_size: u32) -> Result<(String, u32, u32), String> {
    let mut img = image::open(img_path).map_err(|e| e.to_string())?;
    
    // Apply EXIF orientation
    img = apply_orientation(img, img_path);
    
    let (w, h) = (img.width(), img.height());

    // 提高縮圖品質：使用 Lanczos3 濾鏡
    let thumbnail = img.resize(max_size, max_size, image::imageops::FilterType::Lanczos3);

    let mut buf = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut buf);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, 90);
    encoder.encode_image(&thumbnail).map_err(|e| e.to_string())?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok((format!("data:image/jpeg;base64,{}", b64), w, h))
}

#[tauri::command]
async fn request_thumbnail(path: String) -> Result<String, String> {
    // 隨需生成高品質縮圖，每次僅處理一張，極度節省電力
    let (data_url, _, _) = create_thumbnail(&path, 1200)?;
    Ok(data_url)
}

#[tauri::command]
async fn scan_folder(folder_path: String) -> Result<Vec<PhotoInfo>, String> {
    use rayon::prelude::*;

    // 1. 快速蒐集所有合法檔案路徑
    let paths: Vec<_> = WalkDir::new(&folder_path)
        .follow_links(true)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file() && is_image_file(e.path()))
        .collect();

    // 2. 利用 Rayon 平行讀取照片基本尺寸 (header scan)
    let photos: Vec<PhotoInfo> = paths.into_par_iter().filter_map(|entry| {
        let path = entry.path();
        let path_str = path.to_string_lossy().to_string();
        
        // 僅讀取尺寸 HEADER，不解碼整張圖，速度極快
        if let Ok((width, height)) = image::image_dimensions(path) {
            let filename = path.file_name()?.to_string_lossy().to_string();
            let id = format!("{:x}", md5_simple(&path_str));
            Some(PhotoInfo {
                id,
                path: path_str,
                filename,
                width,
                height,
            })
        } else {
            None
        }
    }).collect();

    Ok(photos)
}

#[tauri::command]
async fn get_default_photos_dir() -> Result<String, String> {
    if let Some(home) = dirs_path() {
        let pictures = format!("{}/Pictures", home);
        if std::path::Path::new(&pictures).exists() {
            return Ok(pictures);
        }
    }
    Err("Cannot find Pictures directory".to_string())
}

fn dirs_path() -> Option<String> {
    std::env::var("HOME").ok()
}

fn md5_simple(input: &str) -> u128 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut h1 = DefaultHasher::new();
    input.hash(&mut h1);
    let mut h2 = DefaultHasher::new();
    h1.finish().hash(&mut h2);
    ((h1.finish() as u128) << 64) | (h2.finish() as u128)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            request_thumbnail,
            get_default_photos_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
