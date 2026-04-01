import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const renderDbPath = '/var/data/camap.db';
const localDbPath = path.join(__dirname, 'camap.db');
const configuredDbPath = (process.env.DB_PATH || '').trim();
const preferredDbPath = configuredDbPath || (process.env.RENDER ? renderDbPath : localDbPath);

function ensureDbDirectoryExists(filePath) {
  const dbDir = path.dirname(filePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function openDatabase() {
  const candidates = [preferredDbPath];

  if (process.env.RENDER) {
    if (preferredDbPath !== renderDbPath) candidates.push(renderDbPath);
    // Last-resort writable location to avoid startup crash when disk mount is missing.
    candidates.push('/tmp/camap.db');
  }

  if (preferredDbPath !== localDbPath) {
    candidates.push(localDbPath);
  }

  const uniqueCandidates = [...new Set(candidates)];
  let lastError = null;

  for (const dbPath of uniqueCandidates) {
    try {
      ensureDbDirectoryExists(dbPath);
      const database = new Database(dbPath);
      console.log(`[db] SQLite path: ${dbPath}`);
      return database;
    } catch (error) {
      lastError = error;
      console.error(`[db] Failed opening ${dbPath}: ${error.message}`);
    }
  }

  throw lastError || new Error('Unable to open SQLite database.');
}

const db = openDatabase();

// Pragma for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('temp_store = MEMORY');

// ── SCHEMA ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    avatar     TEXT    DEFAULT NULL,
    role       TEXT    DEFAULT 'user',
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comics (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    author      TEXT NOT NULL,
    translator  TEXT,
    description TEXT,
    cover_url   TEXT,
    home_cover_url TEXT,
    audio_url   TEXT,
    status      TEXT DEFAULT 'ongoing',
    views       INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS genres (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS comic_genres (
    comic_id INTEGER REFERENCES comics(id) ON DELETE CASCADE,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (comic_id, genre_id)
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    comic_id   INTEGER REFERENCES comics(id) ON DELETE CASCADE,
    number     REAL    NOT NULL,
    title      TEXT,
    content    TEXT,
    views      INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chapter_pages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER REFERENCES chapters(id) ON DELETE CASCADE,
    page_num   INTEGER NOT NULL,
    image_url  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id  INTEGER REFERENCES users(id)   ON DELETE CASCADE,
    comic_id INTEGER REFERENCES comics(id)  ON DELETE CASCADE,
    added_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, comic_id)
  );

  CREATE TABLE IF NOT EXISTS recommendations (
    user_id     INTEGER REFERENCES users(id)  ON DELETE CASCADE,
    comic_id    INTEGER REFERENCES comics(id) ON DELETE CASCADE,
    created_at  TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, comic_id)
  );

  CREATE TABLE IF NOT EXISTS reading_history (
    user_id    INTEGER REFERENCES users(id)     ON DELETE CASCADE,
    comic_id   INTEGER REFERENCES comics(id)    ON DELETE CASCADE,
    chapter_id INTEGER REFERENCES chapters(id)  ON DELETE SET NULL,
    read_at    TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, comic_id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    user_id  INTEGER REFERENCES users(id)   ON DELETE CASCADE,
    comic_id INTEGER REFERENCES comics(id)  ON DELETE CASCADE,
    score    INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
    PRIMARY KEY (user_id, comic_id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    comic_id   INTEGER NOT NULL REFERENCES comics(id) ON DELETE CASCADE,
    display_name TEXT,
    comment    TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE (user_id, comic_id)
  );

  CREATE TABLE IF NOT EXISTS token_revocations (
    jti         TEXT PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS home_sliders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    comic_id   INTEGER NOT NULL UNIQUE REFERENCES comics(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    image_url  TEXT NOT NULL,
    link_url   TEXT NOT NULL,
    is_active  INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comics_created_at ON comics(created_at);
  CREATE INDEX IF NOT EXISTS idx_comics_views ON comics(views DESC);
  CREATE INDEX IF NOT EXISTS idx_comics_status ON comics(status);

  CREATE INDEX IF NOT EXISTS idx_comic_genres_comic_id ON comic_genres(comic_id);
  CREATE INDEX IF NOT EXISTS idx_comic_genres_genre_id ON comic_genres(genre_id);

  CREATE INDEX IF NOT EXISTS idx_chapters_comic_id_number ON chapters(comic_id, number DESC);

  CREATE INDEX IF NOT EXISTS idx_favorites_comic_id ON favorites(comic_id);
  CREATE INDEX IF NOT EXISTS idx_recommendations_comic_id ON recommendations(comic_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_comic_id ON ratings(comic_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_comic_id_created_at ON reviews(comic_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_home_sliders_active_order ON home_sliders(is_active, sort_order, id);
`);

// Lightweight migration for existing databases created before new columns were added.
const comicCols = db.prepare("PRAGMA table_info('comics')").all();
if (!comicCols.some((c) => c.name === 'audio_url')) {
  db.exec('ALTER TABLE comics ADD COLUMN audio_url TEXT');
}
if (!comicCols.some((c) => c.name === 'translator')) {
  db.exec('ALTER TABLE comics ADD COLUMN translator TEXT');
}
if (!comicCols.some((c) => c.name === 'home_cover_url')) {
  db.exec('ALTER TABLE comics ADD COLUMN home_cover_url TEXT');
  db.exec("UPDATE comics SET home_cover_url = cover_url WHERE IFNULL(home_cover_url, '') = ''");
}

const chapterCols = db.prepare("PRAGMA table_info('chapters')").all();
if (!chapterCols.some((c) => c.name === 'content')) {
  db.exec('ALTER TABLE chapters ADD COLUMN content TEXT');
}

// ── SEED ─────────────────────────────────────────────────────────────────────
const alreadySeeded = db.prepare('SELECT COUNT(*) as cnt FROM comics').get().cnt > 0;

if (!alreadySeeded) {
  console.log('[db] Database is empty, seeding...');

  // Genres
  const genres = [
    'Ngôn Tình','Hài Hước','Xuyên Không','Hành Động','Phiêu Lưu',
    'Huyền Huyễn','Học Đường','Tâm Lý','Kinh Dị','Thể Thao'
  ];
  const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)');
  genres.forEach(g => insertGenre.run(g));

  // Comics with placeholder covers using picsum (varied IDs)
  const comicsData = [
    { title: 'Chim Hoàng Yến Bị Ép "Lên Chính Thất"', author: 'Diệp Thư', description: 'Nữ chính xuyên không vào tiểu thuyết, trở thành người vợ nhỏ bé trong lồng kính của nam chính phản diện...', cover_url: 'https://picsum.photos/seed/comic1/400/600', home_cover_url: 'https://picsum.photos/seed/comic1h/960/540', status: 'ongoing', views: 210500, genres: [1,2,3] },
    { title: 'Dấu Hôn Của Thiên Sứ', author: 'Vân Lộc', description: 'Một cô gái bình thường bỗng dưng được thiên sứ đến hỏi thăm trong những giấc mơ, rồi cuộc sống của cô thay đổi hoàn toàn...', cover_url: 'https://picsum.photos/seed/comic2/400/600', home_cover_url: 'https://picsum.photos/seed/comic2h/960/540', status: 'ongoing', views: 185000, genres: [1,7] },
    { title: 'Thật Ra Phản Diện Siêu Ngoan', author: 'Mộc Tươi', description: 'Một phản diện bỗng nhiên trở nên ngoan ngoãn khiến mọi người xung quanh không hiểu chuyện gì đang xảy ra...', cover_url: 'https://picsum.photos/seed/comic3/400/600', home_cover_url: 'https://picsum.photos/seed/comic3h/960/540', status: 'completed', views: 320000, genres: [2,4,6] },
    { title: 'Đào Sắc Cát Cánh', author: 'Phong Lan', description: 'Hành trình của một nữ kiếm khách trẻ tuổi từ vô danh trở thành huyền thoại trong giang hồ...', cover_url: 'https://picsum.photos/seed/comic4/400/600', home_cover_url: 'https://picsum.photos/seed/comic4h/960/540', status: 'ongoing', views: 97000, genres: [4,5,6] },
    { title: 'Anh Ấy Nói Yêu Sâu Đậm', author: 'Trà Mạc', description: 'Mối tình học trò đầy ngọt ngào nhưng ẩn chứa những bí mật không ngờ...', cover_url: 'https://picsum.photos/seed/comic5/400/600', home_cover_url: 'https://picsum.photos/seed/comic5h/960/540', status: 'ongoing', views: 145000, genres: [1,7,8] },
    { title: 'Báo Phục', author: 'Hải Đường', description: 'Câu chuyện về một cô gái quyết tâm trả thù những kẻ đã hủy hoại gia đình mình...', cover_url: 'https://picsum.photos/seed/comic6/400/600', home_cover_url: 'https://picsum.photos/seed/comic6h/960/540', status: 'ongoing', views: 260000, genres: [4,8,3] },
    { title: 'Khuyết Điểm', author: 'Lam Ngọc', description: 'Cuộc sống của hai người hoàn toàn khác biệt bỗng giao thoa tạo nên những khoảnh khắc đáng nhớ...', cover_url: 'https://picsum.photos/seed/comic7/400/600', home_cover_url: 'https://picsum.photos/seed/comic7h/960/540', status: 'completed', views: 178000, genres: [1,8] },
    { title: 'Bất Giác Rung Động', author: 'Sương Mai', description: 'Học trường danh tiếng, gặp người đặc biệt, và những rung động đầu tiên không thể nào quên...', cover_url: 'https://picsum.photos/seed/comic8/400/600', home_cover_url: 'https://picsum.photos/seed/comic8h/960/540', status: 'ongoing', views: 420000, genres: [1,2,7] },
    { title: 'Nghịch Ánh Sáng Mà Lớn Lên', author: 'Bạch Lộc', description: 'Câu chuyện trưởng thành đầy cảm xúc về một cậu bé lớn lên dưới bóng tối của xã hội nhưng không bao giờ đánh mất ánh sáng nội tâm...', cover_url: 'https://picsum.photos/seed/comic9/400/600', home_cover_url: 'https://picsum.photos/seed/comic9h/960/540', status: 'ongoing', views: 88000, genres: [8,7,2] },
    { title: 'Thời Gian Quay Lại Gặp Anh', author: 'Nắng Chiều', description: 'Nếu có thể quay ngược thời gian, bạn sẽ chọn con đường nào khác không?', cover_url: 'https://picsum.photos/seed/comic10/400/600', home_cover_url: 'https://picsum.photos/seed/comic10h/960/540', status: 'completed', views: 510000, genres: [1,3,8] },
    { title: 'Hắc Long Truyền Thuyết', author: 'Thiết Ngẫu', description: 'Truyền thuyết về con rồng đen huyền thoại và chàng thanh niên trẻ mang sứ mệnh triệu hồi nó...', cover_url: 'https://picsum.photos/seed/comic11/400/600', home_cover_url: 'https://picsum.photos/seed/comic11h/960/540', status: 'ongoing', views: 392000, genres: [4,5,6] },
    { title: 'Nàng Tiên Cá Quay Đầu', author: 'Ngọc Trinh', description: 'Nàng tiên cá quyết định rời biển để theo đuổi giấc mơ trên mặt đất, nhưng mọi thứ không đơn giản như cô tưởng...', cover_url: 'https://picsum.photos/seed/comic12/400/600', home_cover_url: 'https://picsum.photos/seed/comic12h/960/540', status: 'ongoing', views: 123000, genres: [1,5,6] },
  ];

  const insertComic = db.prepare(`
    INSERT INTO comics (title, author, translator, description, cover_url, home_cover_url, status, views)
    VALUES (@title, @author, @translator, @description, @cover_url, @home_cover_url, @status, @views)
  `);
  const insertComicGenre = db.prepare('INSERT OR IGNORE INTO comic_genres VALUES (?, ?)');
  const insertChapter = db.prepare(`
    INSERT INTO chapters (comic_id, number, title, views, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ? || ' days'))
  `);
  const insertPage = db.prepare('INSERT INTO chapter_pages (chapter_id, page_num, image_url) VALUES (?, ?, ?)');

  const seedAll = db.transaction(() => {
    comicsData.forEach(comic => {
      const { genres: comicGenres, ...rest } = comic;
      const result = insertComic.run({ ...rest, translator: rest.author || '' });
      const comicId = result.lastInsertRowid;

      comicGenres.forEach(gId => insertComicGenre.run(comicId, gId));

      // Add 10–30 chapters per comic
      const numChapters = 10 + Math.floor(Math.random() * 21);
      for (let c = 1; c <= numChapters; c++) {
        const chResult = insertChapter.run(comicId, c, `Chapter ${c}`, Math.floor(Math.random() * 50000), `-${numChapters - c}`);
        const chapId = chResult.lastInsertRowid;
        // 5 pages per chapter (using picsum)
        for (let p = 1; p <= 5; p++) {
          insertPage.run(chapId, p, `https://picsum.photos/seed/ch${chapId}p${p}/800/1200`);
        }
      }
    });

    // Demo user
    const hash = bcrypt.hashSync('demo1234', 10);
    db.prepare('INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)').run('demo', 'demo@camap.com', hash, 'user');
    db.prepare('INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)').run('admin', 'admin@camap.com', bcrypt.hashSync('admin1234', 10), 'admin');

    // Seed sample ads (affiliate links)
    const adsData = [
      {
        title: 'Mở Ứng Dụng LAZADA để mở khóa toàn bộ chương truyện!',
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500&fit=crop',
        link_url: 'https://s.lazada.vn/s.6y43A',
        is_active: 1,
      },
      {
        title: 'Khám phá thế giới mua sắm trên TikTok Shop',
        image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=500&h=500&fit=crop',
        link_url: 'https://tiktok.com/shop',
        is_active: 1,
      },
      {
        title: 'Shopee - Ứng dụng mua sắm #1 tại Việt Nam',
        image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=500&h=500&fit=crop',
        link_url: 'https://shopee.vn',
        is_active: 1,
      }
    ];

    const insertAd = db.prepare(`
      INSERT INTO ads (title, image_url, link_url, is_active)
      VALUES (@title, @image_url, @link_url, @is_active)
    `);

    adsData.forEach(ad => insertAd.run(ad));
  });

  seedAll();
  console.log('[db] Seeding complete. Comics count:', db.prepare('SELECT COUNT(*) as cnt FROM comics').get().cnt);
} else {
  console.log('[db] Database already seeded. Comics count:', db.prepare('SELECT COUNT(*) as cnt FROM comics').get().cnt);
}

export default db;
