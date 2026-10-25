-- Migration number: 0002 	 2026-09-21T07:15:53.829Z

CREATE VIEW review_list AS
SELECT
  reviews.id,
  restaurants.name AS restaurant_name,
  restaurants.url AS restaurant_url,
  reviews.detail_url,
  reviews.title,
  reviews.body,
  reviews.review_date,
  reviews.rating,
  reviews.like_count,
  reviews.scraped_at
FROM reviews
INNER JOIN restaurants
  ON restaurants.url = reviews.restaurant_url;
