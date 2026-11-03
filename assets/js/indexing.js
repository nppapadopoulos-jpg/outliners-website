/* Production has canonical public URLs; temporary mirrors must not be indexed.
 * Staging builds also set X-Robots-Tag at the server and Disallow: / in robots.txt. */
(function(){if(!['outliners.gr','www.outliners.gr','localhost','127.0.0.1'].includes(location.hostname)){var m=document.createElement('meta');m.name='robots';m.content='noindex, nofollow, noarchive';document.head.appendChild(m);}})();
