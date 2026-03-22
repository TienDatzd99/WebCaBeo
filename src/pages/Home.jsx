import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiChevronLeft } from 'react-icons/fi';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectCreative } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';

import { getComics, getFeaturedComics } from '../api/comics.js';
import { CardSquare, CardPortrait } from '../components/ComicCard';
import 'swiper/css/effect-creative';

const FEATURED_LIMIT = 10;
const POPULAR_LIMIT = 10;
const LATEST_LIMIT = 10;

export default function Home() {
    const [featured, setFeatured] = useState([]);
    const [popular, setPopular] = useState([]);
    const [latest, setLatest] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);

    useEffect(() => {
        Promise.all([
            getFeaturedComics(),
            getComics({ limit: 10, sort: 'views' }),
            getComics({ limit: 20 }),
        ])
            .then(([f, p, l]) => {
                setFeatured((f.data.comics || f.data).slice(0, FEATURED_LIMIT));
                setPopular((p.data.comics || p.data).slice(0, POPULAR_LIMIT));
                setLatest((l.data.comics || l.data).slice(0, LATEST_LIMIT));
            })
            .catch((error) => {
                console.error('Failed loading home comics:', error);
            })
            .finally(() => setLoading(false));
    }, []);

    const activeComic = featured[activeIdx] || featured[0] || null;
    const activeHomeCover = activeComic?.home_cover_url || activeComic?.cover_url || '';
    const sliderItemClass = 'w-[85%] shrink-0 sm:w-[47%] lg:w-[24%] xl:w-[calc((100%-80px)/5)]';

    // Định nghĩa mảng sai số để tạo sự khác biệt nhỏ về góc/vị trí giữa các thẻ ở vai trò Prev/Next
const CARD_DNA = [
  // Tất cả x, y đều >= 0 để đẩy từ góc TRÊN - TRÁI vào trong
  { s: 1.0,  x: 0,  y: 0 },   // P1: Full khung chuẩn
  { s: 0.8,  x: 0, y: 0 },  // P2: Nhỏ 80%, hơi lệch khỏi góc trái một chút
  { s: 0.75, x: 0,  y: 0 },   // P3: Nhỏ 75%, hít gần như sát sạt góc trái
  { s: 0.9,  x: 0, y: 0 },  // P4: To 90%, lệch vào trong một khoảng an toàn
  { s: 0.7,  x: 40, y: 20 },  // P5: Nhỏ nhất (70%), nằm lơ lửng gần góc trái
  { s: 0.85, x: 10, y: 15 },  // P6: Vừa phải, bám sát đỉnh trái
  { s: 0.95, x: 5,  y: 0 },   // P7: Gần như full, hít sát lề trái
  { s: 0.78, x: 30, y: 10 },  // P8: Lệch phải một chút nhưng vẫn từ góc trên
  { s: 0.88, x: 0,  y: 20 },  // P9: Hít sát lề trái nhưng lùi xuống dưới một tí
  { s: 0.82, x: 20, y: 5 },   // P10: Cân đối gần góc trên trái
];
    const SkelCard = () => (
        <div className="w-full overflow-hidden rounded-xl bg-[#2d2d2d]">
            <div className="aspect-[4/3] w-full animate-pulse bg-[#3a3a3a]" />
            <div className="space-y-2 bg-[#282828] p-3">
                <div className="h-3 w-4/5 animate-pulse rounded bg-[#3a3a3a]" />
                <div className="h-3 w-3/5 animate-pulse rounded bg-[#3a3a3a]" />
            </div>
        </div>
    );

    return (
        <div
            className="min-h-screen overflow-x-clip"
            style={{
                background: 'linear-gradient(90deg,#232323 0,#232323 10%,#413726 35%,#232323 60%,#232323 100%)',
            }}
        >
            <section className="bg-gradient-to-r from-primary/10 to-secondary/10 items-center justify-center py-0 md:py-0">
                <div className="mx-auto">
                    <section className="relative w-full h-auto flex items-center py-4 sm:py-8">
                        {activeComic && (
                            <div
                                className="absolute inset-0 bg-center bg-cover opacity-40 transition-all duration-700 pointer-events-none"
                                style={{
                                    backgroundImage: `url(${activeHomeCover})`,
                                    filter: 'blur(3rem)'
                                }}
                            />
                        )}

                        <div className="grid grid-cols-12 gap-4 relative z-10 px-4 sm:px-8 lg:px-16 xl:px-24 w-full">
                            <div className="hidden sm:block col-span-12 sm:col-span-5 lg:col-span-4 xl:col-span-3 z-20 mttext-white">
                                {activeComic && (
                                    <>
                                        <h1 className="font-bold mt-4 mb-4 drop-shadow-lg text-[1.5rem] font-sans">
                                            {activeComic.title}
                                        </h1>
                                        <p className="mb-6 text-lg drop-shadow text-sm whitespace-pre-line overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6]">
                                            {activeComic.description || 'Theo dõi bộ truyện nổi bật đang được quan tâm nhất hôm nay.'}
                                        </p>
                                        <Link
                                            to={`/comic/${activeComic.id}`}
                                            className="dark:bg-white dark:text-black dark:hover:bg-gray-200 bg-black text-white px-4 py-1 rounded-2xl shadow-lg font-semibold hover:bg-gray-800"
                                        >
                                            Đọc ngay
                                        </Link>
                                    </>
                                )}
                            </div>

                            <div className="col-span-12 sm:col-span-7 lg:col-span-8 xl:col-span-9 z-20">
                                {featured.length > 0 && (
                                    <div className="w-full">
                                        <Swiper
                                            modules={[Autoplay, Pagination, EffectCreative]}
                                            effect="creative"
                                            creativeEffect={{
                                                limitProgress: 2,
                                                prev: {
                                                    translate: ['-45%', 0, -300],
                                                    scale: 0.85,
                                                    opacity: 0.4,
                                                },
                                                active: {
                                                    translate: [0, 0, 0],
                                                    scale: 1,
                                                    opacity: 1,
                                                },
                                                next: {
                                                    translate: ['45%', 0, -300],
                                                    scale: 0.85,
                                                    opacity: 0.4,
                                                },
                                            }}
                                            grabCursor
                                            centeredSlides
                                            loop
                                            slidesPerView="auto"
                                            watchSlidesProgress
                                            speed={700}
                                            onSlideChange={(swiper) => setActiveIdx(swiper.realIndex)}
                                            autoplay={{ delay: 3500, disableOnInteraction: false }}
                                            pagination={{
                                                el: '.custom-pagination',
                                                clickable: true,
                                            }}
                                            className="w-full"
                                        >
{featured.map((comic) => {
    const homeCover = comic.home_cover_url || comic.cover_url;
    const seedText = String(comic.id ?? '0');
    let hash = 0;
    for (let i = 0; i < seedText.length; i += 1) {
        hash = ((hash << 5) - hash) + seedText.charCodeAt(i);
        hash |= 0;
    }
    const positiveHash = Math.abs(hash);
    // Keep the same top-left anchor for every slide; DNA defines visible size % of the card.
    const sizeDNA = [100, 95, 90, 85, 80, 75, 70, 65, 60, 50];
    const imageSize = sizeDNA[positiveHash % sizeDNA.length];
    const imageScale = imageSize / 100;

    return (
        <SwiperSlide key={comic.id} className="!w-[min(540px,75vw)] lg:!w-[min(600px,65vw)] xl:!w-[854px]">
            {({ isActive, isNext }) => (
                <Link
                    to={`/comic/${comic.id}`}
                    className={`group relative block w-full aspect-[2/1] bg-transparent transition-all duration-700 ${
                        isActive ? 'z-30 shadow-2xl' : (isNext ? 'z-20 shadow-lg' : 'z-10 shadow-md')
                    }`}
                >
                    <div className="absolute -inset-1.5 blur-[15px] rounded-[32px] transition-opacity duration-700" style={{ opacity: isActive ? 0.3 : 0.6 }} />

                    <div
                        className="absolute inset-0 w-full h-full flex items-start justify-start transition-all duration-700 ease-in-out"
                    >
                        <div className="relative w-full h-full">
                            <div className="absolute inset-0 overflow-hidden rounded-[32px]">
                                <img
                                    src={homeCover}
                                    alt={comic.title}
                                    className="absolute top-0 left-0 w-full h-full object-cover"
                                    style={{
                                        objectPosition: 'left top',
                                        transform: `scale(${imageScale})`,
                                        transformOrigin: 'top left',
                                        filter: isActive ? 'brightness(1)' : 'brightness(0.68)',
                                        clipPath: 'inset(0 round 32px)'
                                    }}
                                />
                            </div>

                            <div
                                className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-[44%] max-w-[420px] transition-all duration-700 ${
                                    isActive || isNext ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                                }`}
                                style={{
                                    transform: isNext ? 'translateY(-50%) scale(0.9)' : 'translateY(-50%) scale(1)',
                                    transformOrigin: 'right center'
                                }}
                            >
                                <h2
                                    title={comic.title}
                                    className="text-right text-2xl md:text-4xl font-bold text-white drop-shadow-[0_4px_14px_rgba(0,0,0,0.7)] leading-tight overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]"
                                >
                                    {comic.title}
                                </h2>
                                <div className="mt-3 flex justify-end">
                                    <span className="bg-white/90 text-black text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                                        Dịch giả: {comic.translator || comic.author || 'Đang cập nhật'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Link>
            )}
        </SwiperSlide>
    );
})}
                                        </Swiper>

                                        <div className="custom-pagination mt-2 flex w-full items-center justify-center" />
                                    </div>
                                )}
                            </div>

                        </div>
                    </section>
                </div>
            </section>

            <div className="flex w-full flex-col gap-12 px-4 pb-16 pt-8 sm:px-8 lg:px-16 xl:px-24">
                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-[1.35rem] font-bold text-[#e5e7eb]">Truyện đề cử</h2>
                        <Link
                            to="/search?sort=views"
                            className="group flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/5 text-[#e5e7eb] transition-all duration-300 hover:w-28 hover:gap-1.5 hover:bg-white/10"
                            title="Xem thêm"
                        >
                            <span className="max-w-0 translate-x-1 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-300 group-hover:max-w-20 group-hover:translate-x-0 group-hover:opacity-100">
                                Xem thêm
                            </span>
                            <FiChevronRight className="text-lg" />
                        </Link>
                    </div>

                    <div className="relative">
                        <button
                            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111] shadow-md transition hover:bg-white"
                            onClick={() => document.getElementById('sl-feat')?.scrollBy({ left: -320, behavior: 'smooth' })}
                        >
                            <FiChevronLeft />
                        </button>
                        <div id="sl-feat" className="flex snap-x snap-mandatory gap-5 overflow-x-auto py-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {loading
                                ? Array(5)
                                    .fill(0)
                                    .map((_, i) => (
                                        <div key={i} className={sliderItemClass}>
                                            <SkelCard />
                                        </div>
                                    ))
                                : featured.map((c) => (
                                    <div key={c.id} className={sliderItemClass}>
                                        <CardSquare comic={c} />
                                    </div>
                                ))}
                        </div>
                        <button
                            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111] shadow-md transition hover:bg-white"
                            onClick={() => document.getElementById('sl-feat')?.scrollBy({ left: 320, behavior: 'smooth' })}
                        >
                            <FiChevronRight />
                        </button>
                    </div>
                </section>

                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-[1.35rem] font-bold text-[#e5e7eb]">Truyện được yêu thích</h2>
                        <Link
                            to="/search?sort=favorited"
                            className="group flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/5 text-[#e5e7eb] transition-all duration-300 hover:w-28 hover:gap-1.5 hover:bg-white/10"
                            title="Xem thêm"
                        >
                            <span className="max-w-0 translate-x-1 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-300 group-hover:max-w-20 group-hover:translate-x-0 group-hover:opacity-100">
                                Xem thêm
                            </span>
                            <FiChevronRight className="text-lg" />
                        </Link>
                    </div>

                    <div className="relative">
                        <button
                            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111] shadow-md transition hover:bg-white"
                            onClick={() => document.getElementById('sl-pop')?.scrollBy({ left: -320, behavior: 'smooth' })}
                        >
                            <FiChevronLeft />
                        </button>
                        <div id="sl-pop" className="flex snap-x snap-mandatory gap-5 overflow-x-auto py-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {loading
                                ? Array(5)
                                    .fill(0)
                                    .map((_, i) => (
                                        <div key={i} className={sliderItemClass}>
                                            <SkelCard />
                                        </div>
                                    ))
                                : popular.map((c) => (
                                    <div key={c.id} className={sliderItemClass}>
                                        <CardSquare comic={c} />
                                    </div>
                                ))}
                        </div>
                        <button
                            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111] shadow-md transition hover:bg-white"
                            onClick={() => document.getElementById('sl-pop')?.scrollBy({ left: 320, behavior: 'smooth' })}
                        >
                            <FiChevronRight />
                        </button>
                    </div>
                </section>

                <section>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-[1.35rem] font-bold text-[#e5e7eb]">Truyện mới nhất</h2>
                        <Link
                            to="/search?sort=newest"
                            className="group flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/25 bg-white/5 text-[#e5e7eb] transition-all duration-300 hover:w-28 hover:gap-1.5 hover:bg-white/10"
                            title="Xem thêm"
                        >
                            <span className="max-w-0 translate-x-1 overflow-hidden whitespace-nowrap text-xs font-semibold opacity-0 transition-all duration-300 group-hover:max-w-20 group-hover:translate-x-0 group-hover:opacity-100">
                                Xem thêm
                            </span>
                            <FiChevronRight className="text-lg" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-5 md:grid-cols-5">
                        {loading
                            ? Array(LATEST_LIMIT)
                                .fill(0)
                                .map((_, i) => <SkelCard key={i} />)
                            : latest.map((c) => <CardPortrait key={c.id} comic={c} />)}
                    </div>
                </section>
            </div>
        </div>
    );
}