const POINTS_PER_INCH = 72;
const CONTENT_X = 0.5 * POINTS_PER_INCH;
const CONTENT_Y = 0.5 * POINTS_PER_INCH;
const CONTENT_W = 7.2954 * POINTS_PER_INCH;
const CONTENT_H = 10.3 * POINTS_PER_INCH;
const GUTTER = 11.0;
const MIN_ARTICLE_W = 150;
const MIN_ARTICLE_H = 200;

function computeRemainingRects(placedAds: any[]) {
  const contentRect = { x: CONTENT_X, y: CONTENT_Y, width: CONTENT_W, height: CONTENT_H };
  const activePlaced = placedAds.filter((ad) => ad.placed);
  
  const topMostAdY = Math.min(...activePlaced.map((ad) => ad.placedY));
  const leftMostAdX = Math.min(...activePlaced.map((ad) => ad.placedX));

  const rects: any[] = [];

  const topHeight = topMostAdY - CONTENT_Y - GUTTER;
  if (topHeight >= MIN_ARTICLE_H) {
    rects.push({
      x: CONTENT_X,
      y: CONTENT_Y,
      width: CONTENT_W,
      height: topHeight,
    });
  }

  const bottomLeftWidth = leftMostAdX - CONTENT_X - GUTTER;
  const bottomHeight = (CONTENT_Y + CONTENT_H) - topMostAdY;
  
  if (bottomLeftWidth >= MIN_ARTICLE_W && bottomHeight >= MIN_ARTICLE_H) {
    rects.push({
      x: CONTENT_X,
      y: topMostAdY,
      width: bottomLeftWidth,
      height: bottomHeight,
    });
  }

  return rects;
}

const ads = [{ placed: true, placedX: CONTENT_X + CONTENT_W - 200, placedY: CONTENT_Y + CONTENT_H - 180 }];
console.log(computeRemainingRects(ads));
