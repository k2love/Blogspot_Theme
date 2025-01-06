// 전역 변수 대신 const를 사용하여 상수화
const SCROLL_ANIMATION_DURATION = 700;
const FADE_DURATION = 170;
const SIDEBAR_FIXED_MARGIN_TOP = 30;
const SIDEBAR_FIXED_MARGIN_BOTTOM = 30;
const MOBILE_SUBMENU_ANIMATION_DURATION = 170;
const COOKIE_EXPIRATION_DAYS_DEFAULT = 7;
const CTA_BOTTOM_MARGIN_DEFAULT = 46;
const COPIED_CLASS = 'copied';

// 전역 변수: URL 해시 값에서 "#"을 제거한 값을 저장합니다.
var target = window.location.hash.replace("#", "");

// 텍스트 복사 기능
function copyFunction() {
    // 복사할 텍스트 영역을 표시합니다.
    document.getElementById("getlink").style.display = "inline-block";
    document.getElementById("getlink").select();

    // 텍스트를 복사합니다.
    document.execCommand("copy");
    // 복사 후 텍스트 영역을 숨깁니다.
    document.getElementById("getlink").style.display = "none";
    // "LinkCopy" 클래스를 추가하여 복사 완료 시각적 효과를 줍니다.
    document.getElementById("LinkCopy").classList.add(COPIED_CLASS);
    // 3초 후 "copied" 클래스를 제거하여 시각 효과를 제거합니다.
    setTimeout(function () {
        document.getElementById("LinkCopy").classList.remove(COPIED_CLASS);
    }, 3000);
}

// ShortCode 처리 함수
function shortCodeIfy(e, t, a) {
    // 문자열을 "$" 기준으로 분할합니다.
    var o = e.split("$");
    // "{...}" 형태의 패턴을 찾기 위한 정규식입니다.
    var r = /[^{\}]+(?=})/g;

    for (var i = 0; i < o.length; i++) {
        var s = o[i].split("=");
        // 특정 키 값(t)과 일치하는 경우 해당 값을 추출합니다.
        if (s[0].trim() == t) {
            a = s[1];
            // 추출된 값이 정규식과 일치하면, 일치하는 값을 문자열로 반환합니다.
            if (a.match(r)) {
                return String(a.match(r)).trim();
            }
        }
    }
    // 일치하는 값이 없으면 false를 반환합니다.
    return false;
}


// 에러 메시지 반환 함수
function msgError() {
    return '<span class="error-msg"><b>Error:</b> No Results Found</span>';
}

// 로더(로딩 애니메이션) HTML 반환 함수
function beforeLoader() {
    return '<div class="loader"></div>';
}

// 피드 URL 생성 함수
function getFeedUrl(e, t, a) {
    let o;
    switch (a) {
        // 최근 게시물 피드 URL
        case "recent":
            o = "/feeds/posts/default?alt=json&max-results=" + t;
            break;
        // 특정 레이블 게시물 또는 댓글 피드 URL
        default:
            o = e == "comments" ? "/feeds/comments/default?alt=json&max-results=" + t : "/feeds/posts/default/-/" + a + "?alt=json&max-results=" + t;
    }
    return o;
}


// 게시물 링크 추출 함수
function getPostLink(e, t) {
    for (let a = 0; a < e[t].link.length; a++) {
        if (e[t].link[a].rel == "alternate") {
            return e[t].link[a].href;
        }
    }
    return null; // 링크가 없을 경우 null 반환
}


// 게시물 제목 추출 함수
function getPostTitle(e, t) {
    return e[t].title.$t ? e[t].title.$t : exportify.noTitle;
}

// 게시물 태그 추출 함수
function getPostTag(e, t) {
    return e[t].category ? '<span class="entry-category">' + e[t].category[0].term + "</span>" : "";
}


// 게시물 작성자 정보 추출 함수
function getPostAuthor(e, t, a, o) {
    // exportify.postAuthorLabel 값이 있으면 작성자 라벨을 추가합니다.
    o = exportify.postAuthorLabel != "" ? '<span class="sp">' + exportify.postAuthorLabel + "</span>" : "";
    // exportify.postAuthor 값이 있으면 작성자 정보를 추가합니다.
    return exportify.postAuthor ? '<span class="entry-author mi">' + o + '<span class="author-name">' + e[t].author[0].name.$t + "</span></span>" : "";
}

// 게시물 날짜 정보 추출 함수
function getPostDate(e, t, a, o, r, i, monthNames, dateFormat) {
    // 월 이름 배열 (기본값)
    const DEFAULT_MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    // 날짜 형식 (기본값)
    const DEFAULT_DATE_FORMAT = "{m} {d}, {y}";

    monthNames = monthNames || DEFAULT_MONTH_NAMES;
    dateFormat = dateFormat || DEFAULT_DATE_FORMAT;


    var s = e[t].published.$t;
    var n = s.substring(0, 4);
    var l = s.substring(5, 7);
    var c = s.substring(8, 10);
    var d = dateFormat.replace("{m}", monthNames[parseInt(l, 10) - 1]).replace("{d}", c).replace("{y}", n);
    i = exportify.postAuthor && exportify.postDateLabel != "" ? '<span class="sp">' + exportify.postDateLabel + "</span>" : "";
    return [
        exportify.postDate == 1 ? '<span class="entry-time mi">' + i + '<time class="published" datetime="' + s + '">' + d + "</time></span>" : "",
        exportify.postDate == 1 ? '<span class="entry-time mi"><time class="published" datetime="' + s + '">' + d + "</time></span>" : ""
    ];
}


// 게시물 메타 정보 추출 함수 (작성자, 날짜, 댓글 수)
function getPostMeta(e, t, a, o, r) {
    let i = "";
    // 댓글 수 정보가 있는 경우에만 댓글 수를 표시합니다.
    if (typeof a[o].thr$total !== "undefined") {
        // 관련 게시물 또는 블록 형태에서만 댓글 수를 표시합니다.
        if (r == "related" || r == "block") {
            if (a[o].thr$total.$t > 0) {
                i = "<span class='cmt-count'>" + a[o].thr$total.$t + "</span>";
            }
        }
    }

    return [
        // 작성자 정보 또는 날짜 정보가 있는 경우 메타 정보를 반환합니다.
        exportify.postAuthor == 1 || exportify.postDate == 1 ? '<div class="entry-meta">' + e + t[0] + "</div>" : "",
        // 날짜 정보가 있는 경우 메타 정보와 댓글 수를 반환합니다.
        exportify.postDate == 1 ? '<div class="entry-meta">' + t[1] + i + "</div>" : ""
    ];
}


// 게시물에서 첫 번째 이미지 URL 추출 함수
function getFirstImage(e) {
    var a = $("<div>").html(e).find("img:first").attr("src");
    var o = a.lastIndexOf("/") || 0;
    var r = a.lastIndexOf("/", o - 1) || 0;
    var i = a.substring(0, r);
    var s = a.substring(r, o);
    var n = a.substring(o);
    // 이미지 URL의 크기 관련 부분을 처리합니다.
    if (s.match(/\/s[0-9]+/g) || s.match(/\/w[0-9]+/g) || s == "/d") {
        s = "/w72-h72-p-k-no-nu";
    }
    return i + s + n;
}

// 게시물 이미지 추출 함수
function getPostImage(e, t) {
    var a = e[t].content ? e[t].content.$t : null;
    var o = e[t].media$thumbnail ? e[t].media$thumbnail.url : "https://resources.blogblog.com/img/blank.gif";
    // 게시글에 유튜브 영상이 포함되어 있다면
    if (a && a.indexOf(a.match(/<iframe(?:.+)?src=(?:.+)?(?:www.youtube.com)/g)) > -1) {
        if (a.indexOf("<img") > -1 && a.indexOf(a.match(/<iframe(?:.+)?src=(?:.+)?(?:www.youtube.com)/g)) < a.indexOf("<img")) {
           return o.replace("img.youtube.com", "i.ytimg.com").replace("/default.", "/maxresdefault.");
        } else {
            return o.replace("img.youtube.com", "i.ytimg.com").replace("/default.", "/maxresdefault.");
        }
    } else if (a && a.indexOf("<img") > -1) {
        // 게시글에 이미지가 포함되어 있다면
        return getFirstImage(a);
    } else {
        // 기본 빈 이미지 주소
        return "https://resources.blogblog.com/img/blank.gif";
    }
}



// 게시물 이미지 타입 반환 함수 (비디오 or 이미지)
function getPostImageType(e) {
    return e.match("i.ytimg.com") ? "is-video" : "is-image";
}

// 게시물 요약 추출 함수
function getPostSummary(e, t, a) {
    return e[t].content ? '<span class="entry-excerpt excerpt">' + $("<div>").html(e[t].content.$t).text().trim().substr(0, a) + "…</span>" : "";
}

// 댓글 정보 추출 함수
function getPostComments(e, t, a) {
    var r = e[t].author[0].name.$t;
    var i = e[t].author[0].gd$image.src.replace("/s113", "/s72-c").replace("/s220", "/s72-c");
    var s = e[t].title.$t;

    // 기본 아바타 이미지 처리
    if (i.match("//img1.blogblog.com/img/blank.gif") || i.match("//img1.blogblog.com/img/b16-rounded.gif")) {
        i = "//4.bp.blogspot.com/-oSjP8F09qxo/Wy1J9dp7b0I/AAAAAAAACF0/ggcRfLCFQ9s2SSaeL9BFSE2wyTYzQaTyQCK4BGAYYCw/w72-h72-p-k-no-nu/avatar.jpg";
    }
    // 댓글 정보를 포함한 HTML 문자열을 반환합니다.
    return '<div class="cmm1-item item-' + t + '"><a class="entry-inner wrap-all-link" href="' + a + '" title="' + r + '"><span class="entry-image-wrap cmm-avatar"><span class="entry-thumb" data-image="' + i + '"></span></span><div class="entry-header"><h2 class="entry-title cmm-title">' + r + '</h2><p class="cmm-snippet excerpt">' + s + "</p></div></a></div>";
}

// AJAX 요청 처리 함수
function getAjax(e, t, a, o, r) {
     // 관련 게시물인 경우 결과를 1개 더 가져옵니다.
    if (t == "related") {
        a = parseInt(a) + 1;
    }
    // 피드 URL
     let i;
     switch (t) {
        case "msimple":
        case "ticker":
        case "featured":
        case "block":
        case "grid":
        case "video":
        case "list":
        case "default":
        case "mini":
        case "comments":
        case "related":
            if (o == 0) {
                o = "geterror404";
            }
    }
    i = getFeedUrl(t, a, o);

    // AJAX 요청
    $.ajax({
        url: i,
        type: "GET",
        dataType: "json",
        cache: true,
        beforeSend: function () {
            // 로더 표시
            switch (t) {
                case "ticker":
                case "featured":
                case "block":
                case "grid":
                case "video":
                case "list":
                case "default":
                case "mini":
                case "comments":
                case "related":
                    e.html(beforeLoader()).parent().addClass("type-" + t);
            }
        },
        success: function (a) {
            let r = "";
            let i = -1;
            let s = a.feed.entry;
            // 관련 게시물인 경우, 현재 게시물과 동일한 링크를 가진 게시물의 인덱스를 찾습니다.
            if (t == "related" && s != null) {
                for (let n = 0, l = s; n < l.length; n++) {
                    if (clink == l[n].link.slice(-1)[0].href) {
                        i = n;
                    }
                }
            }
            // 각 레이아웃에 따라 HTML 구조를 설정합니다.
            switch (t) {
                case "msimple":
                    r = '<div class="ul mega-items">';
                    break;
                case "ticker":
                    r = '<div class="ticker-items">';
                    break;
                case "featured":
                    r = '<div class="featured-items">';
                    break;
                case "block":
                case "grid":
                case "list":
                case "video":
                    r = '<div class="content-block ' + t + '-items">';
                    break;
                case "default":
                    r = '<div class="default-items">';
                    break;
                case "mini":
                    r = '<div class="mini-items">';
                    break;
                case "comments":
                    r = '<div class="cmm1-items">';
                    break;
                case "related":
                    r = '<div class="related-posts">';
            }
            
            var c = a.feed.entry;
            if (c != null) {
                 var d = 0;
                for (let l = c; d < l.length; d++) {
                    s = getPostLink(l, d);
                    n = getPostTitle(l, d);
                    var m = getPostTag(l, d);
                    var h = getPostAuthor(l, d);
                    var f = getPostDate(l, d, m);
                    var p = getPostImage(l, d);
                    var u = getPostImageType(p);
                    var g = getPostMeta(h, f, l, d, t);
                    var v = "";
                    // 레이아웃 유형에 따른 HTML 생성
                    switch (t) {
                        case "msimple":
                            v += '<div class="mega-item post"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2>" + g[1] + "</div>";
                            break;
                        case "ticker":
                            v += '<div class="ticker-item item-' + d + '"><h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2></div>";
                            break;
                        case "featured":
                            v += '<div class="featured-item cs item-' + d + '"><a class="featured-inner" href="' + s + '" title="' + n + '"><span class="entry-image-wrap before-mask ' + u + '"><span class="entry-thumb" data-image="' + p + '"></span></span><div class="entry-header entry-info">' + m + '<h2 class="entry-title">' + n + "</h2>" + g[0] + "</div></a></div>";
                            break;
                         case "block":
                            switch (d) {
                                case 1:
                                    v += '<div class="block-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header">' + g[1] + '<h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2>" + getPostSummary(l, d, 160) + "</div></div>";
                                    break;
                                default:
                                    v += '<div class="block-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header">' + g[1] + '<h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2></div></div>";
                            }
                            break;
                        case "grid":
                            v += '<div class="grid-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header"><h2 class="entry-title"><a title="' + n + '" href="' + s + '">' + n + "</a></h2>" + g[1] + "</div></div>";
                            break;
                        case "list":
                            v += '<div class="list-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header"><h2 class="entry-title"><a title="' + n + '" href="' + s + '">' + n + "</a></h2>" + getPostSummary(l, d, 120) + g[0] + "</div></div>";
                            break;
                        case "video":
                            v += '<div class="video-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  is-video" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header"><h2 class="entry-title"><a title="' + n + '" href="' + s + '">' + n + "</a></h2>" + g[1] + "</div></div>";
                            break;
                        case "default":
                            v += '<div class="default-item ds item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header"><h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2>" + g[1] + "</div></div>";
                            break;
                        case "mini":
                            v += '<div class="mini-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" viewBox="0 0 16 9" data-image="' + p + '"/></a><div class="entry-header"><h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2>" + g[1] + "</div></div>";
                            break;
                        case "comments":
                            v += getPostComments(l, d, s);
                            break;
                        case "related":
                            if (l.length > 1 && (d == i || (i < 0 && d == l.length - 1))) {
                                continue;
                            }
                            v += '<div class="related-item item-' + d + '"><a title="' + n + '" class="entry-image-wrap  ' + u + '" href="' + s + '"><svg class="entry-thumb" width="100" height="62.5" viewBox="0 0 16 9" width="" data-image="' + p + '"/></a><div class="entry-header"><h2 class="entry-title"><a href="' + s + '" title="' + n + '">' + n + "</a></h2>" + g[1] + "</div></div>";
                    }
                    r += v;
                }
            } else {
                // 게시물이 없을 때 에러 메시지 표시
                switch (t) {
                    case "msimple":
                        r = '<div class="ul mega-items no-items">' + msgError() + "</div>";
                        break;
                    default:
                        r = msgError();
                }
            }
            // 최종 HTML 출력 및 추가 작업
             switch (t) {
                case "msimple":
                    r += "</div>";
                    e.append(r).addClass("msimple");
                    e.find("a:first").attr("href", function (e, t) {
                        switch (o) {
                            case "recent":
                                t = t.replace(t, "/search");
                                break;
                            default:
                                t = t.replace(t, "/search/label/" + o);
                        }
                        return t;
                    });
                    break;
                case "ticker":
                    r += "</div>";
                    e.html(r).tickerify();
                    break;
                default:
                    r += "</div>";
                    e.html(r);
            }
             // lazy loading 이미지 처리
            e.find("span.entry-thumb,svg.entry-thumb").lazyify();
        },
        error: function () {
           // 에러 발생 시 에러 메시지 표시
           switch (t) {
                case "msimple":
                    e.append('<div class="ul mega-items no-items">' + msgError() + "</div>");
                    break;
                default:
                    e.html(msgError());
            }
        }
    });
}

function handleAjax(e, t, a, o, r, successCallback) {
     if (r.match("getcontent")) {
        return getAjax(e, t, a, o, r);
    }
    e.html(msgError());
}

// 메가 메뉴 AJAX 로드 함수
function ajaxMega(e, t, a, o, r) {
     if (r.match("getcontent")) {
        if (t == "msimple") {
            return getAjax(e, t, a, o);
        }
        e.append('<div class="ul mega-items no-items">' + msgError() + "</div>");
    }
}

// 티커 AJAX 로드 함수
function ajaxTicker(e, t, a, o, r) {
    if (r.match("getcontent")) {
        if (t == "ticker") {
             return getAjax(e, t, a, o);
        }
        e.html(msgError());
    }
}

// 주요 게시물 AJAX 로드 함수
function ajaxFeatured(e, t, a, o, r) {
     if (r.match("getcontent")) {
        if (t == "featured") {
            return getAjax(e, t, a, o);
        }
        e.html(msgError());
    }
}

// 블록, 그리드, 목록, 비디오 위젯 AJAX 로드 함수
function ajaxBlock(e, t, a, o, r, i, s) {
     if (r.match("getcontent")) {
        if (t == "block" || t == "grid" || t == "list" || t == "video") {
            // "모두 보기" 링크 추가
            if (o != 0) {
                i = o == "recent" ? "/search" : "/search/label/" + o;
                s = viewAllText.trim() != "" ? viewAllText : exportify.viewAll;
                e.parent().find(".widget-title").append('<a href="' + i + '" class="wt-l">' + s + "</a>");
            }
            return getAjax(e, t, a, o);
        }
        e.html(msgError());
    }
}
// 기본, 미니, 댓글 위젯 AJAX 로드 함수
function ajaxWidget(e, t, a, o, r) {
    if (r.match("getcontent")) {
        if (t == "default" || t == "mini" || t == "comments") {
            return getAjax(e, t, a, o);
        }
        e.html(msgError());
    }
}

// 관련 게시물 AJAX 로드 함수
function ajaxRelated(e, t, a, o, r) {
    return getAjax(e, t, a, o, r);
}


// Disqus 댓글 로드 함수
function disqusComments(e) {
    var t = document.createElement("script");
    t.type = "text/javascript";
    t.async = true;
    t.src = "//" + e + ".disqus.com/blogger_item.js";
    (document.getElementsByTagName("head")[0] || document.getElementsByTagName("body")[0]).appendChild(t);
}

// 아바타 이미지 URL 변경 함수
function beautiAvatar(e) {
    $(e).attr("src", function (e, t) {
        // 기본 아바타 이미지 URL을 변경합니다.
        t = t.replace("//resources.blogblog.com/img/blank.gif", "//4.bp.blogspot.com/-oSjP8F09qxo/Wy1J9dp7b0I/AAAAAAAACF0/ggcRfLCFQ9s2SSaeL9BFSE2wyTYzQaTyQCK4BGAYYCw/s39/avatar.jpg");
        t = t.replace("//lh3.googleusercontent.com/zFdxGE77vvD2w5xHy6jkVuElKv-U9_9qLkRYK8OnbDeJPtjSZ82UPq5w6hJ-SA=s35", "//4.bp.blogspot.com/-oSjP8F09qxo/Wy1J9dp7b0I/AAAAAAAACF0/ggcRfLCFQ9s2SSaeL9BFSE2wyTYzQaTyQCK4BGAYYCw/s39/avatar.jpg");
        t = t.replace("/s35", "/s39");
        return t;
    });
}


// 고정 사이드바 함수
function fixedSidebarIfy(e) {
    $(e).each(function () {
        // 고정 사이드바 설정
        fixedSidebar = typeof fixedSidebar == "undefined" || fixedSidebar;
        if (fixedSidebar == 1) {
            var e = fixedMenu == 1 ? 89 : SIDEBAR_FIXED_MARGIN_TOP;
            $(this).theiaStickySidebar({
                containerSelector: "#content-wrapper > .container",
                additionalMarginTop: e,
                additionalMarginBottom: SIDEBAR_FIXED_MARGIN_BOTTOM,
            });
        }
    });
}

// 스크립트 초기화 함수
window.location.hash = ""; // 페이지 로딩 시 해시 값 초기화
$(window).on("load", function () {
    // 해시 값으로 특정 요소 스크롤 이동
    if (target) {
        $("html, body").animate({ scrollTop: $("#" + target).offset().top }, SCROLL_ANIMATION_DURATION, "swing", function () { });
    }
    // 내부 링크 클릭시 스크롤 이동 애니메이션
    $('a[href*="#"]:not(".tocify-wrap a")').on("click", function (e) {
        var t = this.hash;
        var a = new URL(this.href);
        var o = new URL(window.location.href);
        a.hash = "";
        o.hash = "";
        // 동일 페이지 내의 링크인 경우 스크롤 이동
        if (t && $(t).length && a.href == o.href) {
            e.preventDefault();
            $("html, body").animate({ scrollTop: $(t).offset().top - 10 }, 750);
        }
    });
});


// 전역 변수
var fixedMenu = typeof fixedMenu == "undefined" || fixedMenu;
var viewAllText = typeof viewAllText != "undefined" ? viewAllText : exportify.viewAll;

// 메인 메뉴 초기화
$("#vtrick-pro-main-nav").menuify();
$("#vtrick-pro-main-nav .widget").addClass("show-menu");

// 검색 기능
$(".show-search").on("click", function () {
    $("body").addClass("search-active");
    $("#main-search-wrap").fadeIn(FADE_DURATION).find("input").focus();
});
$(".search-close").on("click", function () {
    $("body").removeClass("search-active");
    $("#main-search-wrap").fadeOut(FADE_DURATION).find("input").blur();
});

// 다크 모드 기능
$("html").each(function () {
    var e = $(this);
    var darkMode = typeof darkMode != "undefined" && darkMode;
    var userDarkMode = typeof userDarkMode == "undefined" || userDarkMode;
    if (darkMode != 1 && userDarkMode != 0) {
        if (localStorage.themeColor == "dark") {
            e.addClass("is-dark");
        }
        $(".darkmode-toggle").on("click", function () {
            if (localStorage.themeColor != "dark") {
                e.addClass("is-dark");
                localStorage.themeColor = "dark";
            } else {
                e.removeClass("is-dark");
                localStorage.themeColor = "light";
            }
        });
    }
});


// 티커 위젯 초기화
$("#ticker .PopularPosts .widget-content").tickerify();

// 블로그 제목 "모두 보기" 링크
$(".bp-title a.wt-l").each(function () {
    if (viewAllText.trim() != "") {
        $(this).text(viewAllText);
    }
});


// 소셜 아이콘 위젯 초기화
$(".sidebar .social-icons li a").each(function (e) {
    var t = $(this);
    var a = t.attr("href").split("#");
    if (a[1] != null && (e = a[1].trim()) != "") {
        t.append('<span class="text">' + e + "</span>");
    }
    t.attr("href", a[0].trim());
});

// 이메일 구독 위젯 초기화
$(".FollowByEmail .widget-content").each(function (e, t) {
    var a = $(this);
    var o = a.data("shortcode");
    if (o != null) {
        e = shortCodeIfy(o, "title");
        t = shortCodeIfy(o, "text");
        if (e != 0) {
            a.find(".follow-by-email-title").text(e);
        }
        if (t != 0) {
            a.find(".follow-by-email-text").text(t);
        }
    }
});


// 버튼 처리
$(".post-body a").each(function () {
    var e = $(this);
    var t = e.html();
    var a = t.toLowerCase();
    var o = shortCodeIfy(t, "text");
    var r = shortCodeIfy(t, "icon");
    var i = shortCodeIfy(t, "color");
    if (a.match("getbutton") && o != 0) {
        e.addClass("button btn").text(o);
        if (r != 0) {
            e.addClass(r);
        }
        if (i != 0) {
            e.addClass("colored-button").attr("style", "background-color:" + i + ";");
        }
    }
});

// 특정 키워드 처리
$(".post-body b").each(function () {
    var e = $(this);
    var t = e.text().toLowerCase().trim();
    if (t.match("{contactform}")) {
        e.replaceWith('<div class="contact-form"/>');
        $(".contact-form").append($("#ContactForm1"));
    }
    if (t.match("{leftsidebar}")) {
        $("body").addClass("is-left");
        e.remove();
    }
    if (t.match("{rightsidebar}")) {
        $("body").addClass("is-right").removeClass("is-left");
        e.remove();
    }
    if (t.match("{fullwidth}")) {
        $("body").addClass("no-sidebar");
        e.remove();
    }
});


// 광고 영역
$("#vtrick-pro-new-before-ad").each(function () {
    var e = $(this);
    if (e.length) {
        $("#before-ad").appendTo(e);
    }
});
$("#vtrick-pro-new-after-ad").each(function () {
    var e = $(this);
    if (e.length) {
        $("#after-ad").appendTo(e);
    }
});
$("#vtrick-pro-main-before-ad .widget").each(function () {
    var e = $(this);
    if (e.length) {
        e.appendTo($("#before-ad"));
    }
});
$("#vtrick-pro-main-after-ad .widget").each(function () {
    var e = $(this);
    if (e.length) {
        e.appendTo($("#after-ad"));
    }
});
$("#vtrick-pro-post-footer-ads .widget").each(function () {
    var e = $(this);
    if (e.length) {
        e.appendTo($("#post-footer-ads"));
    }
});


// 알림 메시지 및 코드 상자 처리
$(".post-body blockquote").each(function () {
    var e = $(this);
    var t = e.text().toLowerCase().trim();
    var a = e.html();
    if (t.match("{alertsuccess}")) {
        var t = a.replace("{alertSuccess}", "");
        e.replaceWith('<div class="alert-message alert-success">' + t + "</div>");
    }
    if (t.match("{alertinfo}")) {
        var t = a.replace("{alertInfo}", "");
        e.replaceWith('<div class="alert-message alert-info">' + t + "</div>");
    }
    if (t.match("{alertwarning}")) {
        var t = a.replace("{alertWarning}", "");
        e.replaceWith('<div class="alert-message alert-warning">' + t + "</div>");
    }
    if (t.match("{alerterror}")) {
        var t = a.replace("{alertError}", "");
        e.replaceWith('<div class="alert-message alert-error">' + t + "</div>");
    }
    if (t.match("{codebox}")) {
        var t = a.replace("{codeBox}", "");
        e.replaceWith('<pre class="code-box">' + t + "</pre>");
    }
});

// 코드 하이라이트
$(".post-body pre").each(function () {
    var e = $(this);
    var t = e.html();
    var a = e.attr("lang") || "html";
    if (e.is("[lang]")) {
        e.replaceWith('<pre class="language-' + a + '"><code>' + t + "</code></pre>");
    }
});

// 공유하기 링크
$(".entry-share-links .window-ify,.post-share .window-ify").on("click", function () {
    var e = $(this);
    var t = e.data("url");
    var a = e.data("width");
    var o = e.data("height");
    var r = window.screen.width;
    var i = window.screen.height;
    var s = Math.round(r / 2 - a / 2);
    var n = Math.round(i / 2 - o / 2);
    window.open(t, "_blank", "scrollbars=yes,resizable=yes,toolbar=no,location=yes,width=" + a + ",height=" + o + ",left=" + s + ",top=" + n).focus();
});

// 공유 링크 토글
$(".vtrick-pro-share-links").each(function () {
    var e = $(this);
    e.find(".show-hid a").on("click", function () {
        e.toggleClass("show-hidden");
    });
});

// 작성자 소개 영역
$(".about-author .author-text").each(function () {
    var e = $(this);
    var t = e.find("a");
    t.each(function () {
        var e = $(this);
        var t = e.text().trim();
        var a = e.attr("href");
        e.replaceWith('<li class="' + t + '"><a href="' + a + '" title="' + t + '" rel="noopener noreferrer" target="_blank"/></li>');
    });
    if (t.length) {
        e.parent().append('<ul class="author-links social social-color"></ul>');
    }
    e.find("li").appendTo(".author-links");
});


// 메가 메뉴 AJAX 로드
$("#vtrick-pro-main-nav-menu li.mega-menu").each(function (e, t) {
    var a = $(this);
    var o = a.find("a").data("shortcode");
    if (o != null) {
        e = o.toLowerCase();
        ajaxMega(a, "msimple", 5, shortCodeIfy(o, "label"), e);
    }
});

// 티커 위젯 AJAX 로드
$("#ticker .HTML .widget-content").each(function (e, t) {
    var a = $(this);
    var o = $(window);
    var r = a.data("shortcode");
    if (r != null) {
        var mtc = r.toLowerCase();
        e = shortCodeIfy(r, "results");
        t = shortCodeIfy(r, "label");
         o.on("load resize scroll", function r() {
            if (o.scrollTop() + o.height() >= a.offset().top) {
                o.off("load resize scroll", r);
                ajaxTicker(a, "ticker", e, t, mtc);
            }
        }).trigger("scroll");
    }
});

// 주요 게시물 위젯 AJAX 로드
$("#featured .HTML .widget-content").each(function (e) {
    var t = $(this);
    var a = $(window);
    var o = t.data("shortcode");
    if (o != null) {
        var mtc = o.toLowerCase();
        e = shortCodeIfy(o, "label");
          a.on("load resize scroll", function o() {
            if (a.scrollTop() + a.height() >= t.offset().top) {
                a.off("load resize scroll", o);
                ajaxFeatured(t, "featured", 3, e, mtc);
            }
        }).trigger("scroll");
    }
});


// 콘텐츠 섹션 위젯 AJAX 로드
$(".content-section .HTML .widget-content").each(function (e, t, a) {
    var o = $(this);
    var r = $(window);
    var i = o.data("shortcode");
    if (i != null) {
        var mtc = i.toLowerCase();
        e = shortCodeIfy(i, "results");
        t = shortCodeIfy(i, "label");
        a = shortCodeIfy(i, "type");
         r.on("load resize scroll", function i() {
            if (r.scrollTop() + r.height() >= o.offset().top) {
                r.off("load resize scroll", i);
                 ajaxBlock(o, a, e, t, mtc);
            }
        }).trigger("scroll");
    }
});

// 위젯 AJAX 로드
$(".vtrick-pro-widget-ready .HTML .widget-content").each(function (e, t, a, o) {
    var r = $(this);
    var i = $(window);
    var s = r.data("shortcode");
    if (s != null) {
        e = s.toLowerCase();
        t = shortCodeIfy(s, "results");
        a = shortCodeIfy(s, "label");
        o = shortCodeIfy(s, "type");
          i.on("load resize scroll", function s() {
             if (i.scrollTop() + i.height() >= r.offset().top) {
                i.off("load resize scroll", s);
                 ajaxWidget(r, o, t, a, e);
            }
        }).trigger("scroll");
    }
});


// 관련 게시물 위젯 AJAX 로드
$("#vtrick-pro-related-posts .HTML").each(function (e, t) {
    var a = [];
    $(".vtrick-pro-related-content meta").each(function () {
        a.push($(this).attr("content"));
    });
    var o = $(this).data("shortcode");
    if (o != null) {
        function r() {
            var e = shortCodeIfy(o, "title");
            var t = shortCodeIfy(o, "results");
            return [e, t];
        }
         $("#related-wrap").each(function (e, t) {
            var o = $(this);
            var i = $(window);
            var s = o.find(".vtrick-pro-related-content");
            var n = r();
            e = n[1] != 0 ? n[1] : 3;
            if (n[0] != 0) {
                o.find(".related-title .title > span").text(n[0]);
            }
            t = o.find(".related-tag").data("label");
             i.on("load resize scroll", function o() {
                if (i.scrollTop() + i.height() >= s.offset().top) {
                    i.off("load resize scroll", o);
                    ajaxRelated(s, "related", e, t, a);
                }
            }).trigger("scroll");
         });
    }
});


// 댓글 시스템 처리
$(".vtrick-pro-blog-post-comments").each(function () {
    var e = $(this);
    var t = e.data("shortcode");
    var a = shortCodeIfy(t, "type");
    var o = "comments-system-" + a;
    var r = e.find("#top-continue .comment-reply");
    switch (a) {
        case "disqus":
            var i = shortCodeIfy(t, "shortname");
            if (i != 0) {
                disqus_shortname = i;
            }
            disqusComments(disqus_shortname);
            e.addClass(o).show();
            break;
        case "facebook":
            e.addClass(o).find("#comments").html('<div class="fb-comments" data-width="100%" data-href="' + disqus_blogger_current_url + '" order_by="time" data-numposts="5" data-lazy="true"></div>');
            e.show();
            break;
        case "hide":
            e.hide();
            break;
        default:
            e.addClass("comments-system-blogger").show();
            $(".entry-meta .entry-comments-link").addClass("show");
            r.addClass("btn");
    }
});


// lazyload 및 모바일 메뉴
$(function () {
    // 이미지 레이지 로드
    $(".entry-image-wrap .entry-thumb,.author-avatar-wrap .author-avatar, .ratio-16-10").lazyify();
    
     // Particle 초기화
    $("#particle").each(function(){
        $(this).attr("data-image", "");
    });

    // 모바일 메뉴
    $("#vtrick-pro-mobile-menu").each(function(){
         var e=$(this),
            t=$("#vtrick-pro-main-nav-menu").clone();
        t.attr("id","main-mobile-nav");
        t.find(".mega-items").remove();
        t.find(".mega-menu > a").each(function(e,t){
            var a=$(this),
            o=a.data("shortcode");
            if(null!=o){
                t="recent"==(e=shortCodeIfy(o.trim(),"label"))?"/search":"/search/label/"+e;
                a.attr("href",t)
            }
        });
    t.appendTo(e);

    // 모바일 메뉴 토글
        $(".mobile-menu-toggle, .hide-vtrick-pro-mobile-menu, .overlay").on("click",function(){
            $("body").toggleClass("nav-active");
        });

    // 서브메뉴 토글
        $(".vtrick-pro-mobile-menu .has-sub").append('<div class="submenu-toggle"/>');
        $(".vtrick-pro-mobile-menu .mega-menu").find(".submenu-toggle").remove();
         $(".vtrick-pro-mobile-menu ul li .submenu-toggle").on("click",function(e){
            var t=$(this).parent();
            if(t.hasClass("has-sub")){
                e.preventDefault();
                t.hasClass("show")?t.removeClass("show").find("> .m-sub").slideToggle(MOBILE_SUBMENU_ANIMATION_DURATION):t.addClass("show").children(".m-sub").slideToggle(MOBILE_SUBMENU_ANIMATION_DURATION);
            }
        });
    });

    
     // 모바일 메뉴 푸터 소셜 영역
    $(".mm-footer .mm-social").each(function () {
        var e = $(this);
         var t = $("#vtrick-pro-about-section ul.social").clone();
        t.removeClass("social-bg-hover");
        t.appendTo(e);
    });
    
     // 모바일 메뉴 푸터 메뉴 영역
    $(".mm-footer .mm-menu").each(function () {
       var e = $(this);
        $("#footer-menu ul.link-list").clone().appendTo(e);
    });

    
    // 헤더 스크롤 효과
    $(".header-inner").each(function () {
         var e = $(this);
         if (fixedMenu == 1 && e.length > 0) {
            var t = $(document).scrollTop();
            var a = e.offset().top;
            var o = e.height();
             var r = a + o + o;
            $(window).scroll(function () {
                var o = $(document).scrollTop();
                if (o > r) {
                     e.addClass("is-fixed");
                } else if (o < a || o <= 1) {
                    e.removeClass("is-fixed");
                }
                 if (o > t) {
                    e.removeClass("show");
                } else {
                     e.addClass("show");
                }
                t = o;
            });
        }
    });


     // 고정 사이드바 기능
    fixedSidebarIfy("#main-wrapper, #sidebar-wrapper");

    // iframe 반응형 처리
    $("#post-body iframe").each(function () {
        var e = $(this);
        if (e.attr("src").match("www.youtube.com")) {
            e.wrap('<div class="responsive-video-wrap"/>');
        }
    });


    // 댓글 내 이미지 및 유튜브 영상 반응형 처리
    $("p.comment-content").each(function () {
        var e = $(this);
        e.replaceText(/(https:\/\/\S+(\.png|\.jpeg|\.jpg|\.gif))/g, '<img src="$1"/>');
        e.replaceText(/(?:https:\/\/)?(?:www\.)?(?:youtube\.com)\/(?:watch\?v=)?(.+)/g, '<div class="responsive-video-wrap"><iframe id="youtube" width="100%" height="358" class="lazyload" data-src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>');
    });


     // "더 보기" 버튼 기능, 무한 스크롤 로딩
    $("#vtrick-pro-load-more-link").each(function(){
        var loadMore = $(this);
        var loadUrl = loadMore.data("load");
        if(loadUrl){
            loadMore.show();
             loadMore.on("click", function(e){
                e.preventDefault();
                loadMore.hide();
                 $.ajax({
                    url: loadUrl,
                     success: function(data){
                         var posts = $(data).find(".blog-posts");
                         posts.find(".index-post").addClass("post-animated post-fadeInUp");
                         $(".blog-posts").append(posts.html());
                         loadUrl = $(data).find("#vtrick-pro-load-more-link").data("load");
                         if(loadUrl){
                            loadMore.show();
                         } else {
                            loadMore.hide();
                            $("#blog-pager .no-more").addClass("show");
                         }
                    },
                     beforeSend: function(){
                        $("#blog-pager .loading").show();
                    },
                     complete: function(){
                        $("#blog-pager .loading").hide();
                        $(".index-post .entry-image-wrap .entry-thumb,.author-avatar-wrap .author-avatar").lazyify();
                        fixedSidebarIfy("#main-wrapper");
                     }
                });
            });
        }
    });

    
    // 쿠키 동의 처리
    $("#vtrick-pro-cookie-ify").each(function () {
         var e = $(this);
         var t = e.find(".widget.Text").data("shortcode");
        if (t != null) {
            var ok = shortCodeIfy(t, "ok");
            var days = shortCodeIfy(t, "days");
            if (ok != 0) {
                 e.find("#vtrick-pro-cookie-ify-accept").text(ok);
            }
            if (days != 0) {
                 days = Number(days);
             } else {
                days = COOKIE_EXPIRATION_DAYS_DEFAULT;
            }
        }
        // 쿠키 동의 여부 확인 및 처리
         if (e.length > 0) {
            if ($.cookie("vtrick_pro_cookie_ify_consent") !== "1") {
                e.css("display", "block");
                $(window).on("load", function () {
                     e.addClass("is-visible");
                });
            }
            // 쿠키 동의 버튼 클릭 시
             $("#vtrick-pro-cookie-ify-accept").off("click").on("click", function (t) {
                t.preventDefault();
                t.stopPropagation();
                 $.cookie("vtrick_pro_cookie_ify_consent", "1", { expires: days, path: "/" });
                e.removeClass("is-visible");
                setTimeout(function () {
                     e.css("display", "none");
                }, 500);
             });
           cookieChoices = {};
        }
    });
    
    // 최상단 이동 버튼 기능
     $("#back-top").each(function () {
         var e = $(this);
        $(window).on("scroll", function () {
            var t = window.innerHeight;
            var a = $("#vtrick-pro-cta2-section ul.cta-containter");
           // 스크롤 위치에 따라 버튼 및 CTA 영역 표시/숨김 처리
             if ($(this).scrollTop() >= 100) {
                e.fadeIn(FADE_DURATION);
                if (!a.hasClass("has-backtop")) {
                     a.animate({ bottom: "+=" + CTA_BOTTOM_MARGIN_DEFAULT + "px" }, FADE_DURATION);
                    a.addClass("has-backtop");
                 }
            } else {
                e.fadeOut(FADE_DURATION);
                 if (a.hasClass("has-backtop")) {
                    a.animate({ bottom: "-=" + CTA_BOTTOM_MARGIN_DEFAULT + "px" }, FADE_DURATION);
                     a.removeClass("has-backtop");
                }
            }
            // 푸터 영역에 도달하면 CTA 영역 숨김 처리
             if (e.hasClass("on-footer") && !a.hasClass("get-footer")) {
                a.animate({ bottom: "-=" + CTA_BOTTOM_MARGIN_DEFAULT + "px" }, FADE_DURATION);
                 a.addClass("get-footer");
            }
            if (!e.hasClass("on-footer") && a.hasClass("get-footer")) {
                 a.animate({ bottom: "+=" + CTA_BOTTOM_MARGIN_DEFAULT + "px" }, FADE_DURATION);
                a.removeClass("get-footer");
            }
            
             // 푸터 영역에 도달 여부에 따라 클래스 추가/제거
             if ($(this).scrollTop() + t >= $("#footer-wrapper").offset().top + 36) {
                e.addClass("on-footer");
             } else {
                e.removeClass("on-footer");
            }
        });
        // 최상단 이동
        e.on("click", function () {
           $("html, body").animate({ scrollTop: 0 }, 500);
         });
    });
});