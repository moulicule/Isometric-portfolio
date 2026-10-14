const bar=document.querySelector('#reading-progress');
function updateProgress(){const max=document.documentElement.scrollHeight-innerHeight;bar.style.width=`${max>0?scrollY/max*100:0}%`;}
addEventListener('scroll',updateProgress,{passive:true});addEventListener('resize',updateProgress);updateProgress();
