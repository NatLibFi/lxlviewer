
export function openTerm(ref, insidePopover, position) {

  let loaded = false;
  let $embedvocab = $('#embedvocab');
  let linkPos = {};
  if (position) {
    linkPos = position;
  }

  function display() {
    // Log
    var layoutRef = $('body').attr('id');
    if (typeof(_paq) !== 'undefined') _paq.push(['trackEvent', layoutRef, 'Vocab popup', ref]);

    $embedvocab.show();
    $('.state-active').removeClass('state-active');
    $('#' + ref).addClass('state-active');

    var flipOrientation = false;
    if(linkPos.right > $(window).width()/1.5) {
      flipOrientation = true;
    }

    // Constrain popover location to within page
    var popoverH = $('.state-active').height();
    var popoverY = linkPos.Y - (popoverH*0.5) + 8;
    $('.state-active .arrow').css('top', '50%');
    if (popoverY < 50) {
      popoverY = linkPos.Y - (popoverH*0.25) + 8;
      $('.state-active .arrow').css('top', '25%');
    }
    if (popoverY + popoverH > $(document).height() - popoverH *0.25) {
      popoverY -= popoverH*0.25;
    }
    if (popoverY < 55) {
      popoverY = 55;
    }

    if(flipOrientation) {
      $('.state-active')
        .css('top', popoverY + "px")
        .css('left', (linkPos.X - $('.state-active').width() - 5) + "px")
        .addClass('left').removeClass('right');
    }
    else {
      $('.state-active')
        .css('top', popoverY + "px")
        .css('left', (linkPos.right + 5) + "px")
        .addClass('right').removeClass('left');
    }

    $('.state-active .panel-body').scrollTop(0);

    // if(insidePopover)
      $('.state-active .arrow').css('display', 'none');
    // else
      // $('.state-active .arrow').css('display', 'block');

  }
  if (!loaded) {
    $('body').addClass('loading');
    $embedvocab.append('<article class="panel text-center">' +
                      '<i class="glyphicon glyphicon-refresh btn-lg"></i></article>');
    $embedvocab.load("/vocab/ article.panel[id]", function() {
      $('article.panel[id]', this).
        addClass('popover').
        prepend('<div class="arrow"></div>');
      $('body').removeClass('loading');
      $('a[href^="http"]').attr('target', '_blank').click(function (event) {
        event.stopPropagation();
      });
      display();
    });
    loaded = true;
  } else {
    display();
  }

}

export function initVocabClicks() {

  var embedvocab = $('<div id="embedvocab"></div>').appendTo('body');

  $('#embedvocab').hide();

  $('*').click(function(event) {
    // Handles closing of popovers
    var $elem = $(event.target);
    if (!$elem.is('a')) {
      for (var i = 0; i < 10; i++) {
        if ($elem.attr('id') == 'embedvocab') {
          return false;
        }
        $elem = $elem.parent();
      }
    }
    $('.state-active').removeClass('state-active');
    $('#embedvocab').hide();
  });

  var termLinkSel = 'a[href^="/vocab/#"]';
  var articleLinkSel = 'article.panel a[href^="#"]';

  $(document).on('click', articleLinkSel, function (e) {
    e.preventDefault();
    var ref = $(this).attr('href').replace(/[^#]*#(.*)/, "$1");

    openTerm(ref, true);
    return false;
  });

  $(document).on('click', termLinkSel, function (e) {
    e.preventDefault();
    var ref = $(this).attr('href').replace(/[^#]*#(.*)/, "$1");

    let linkPos = {}
    linkPos.X = $(this).offset().left;
    linkPos.Y = $(this).offset().top;
    linkPos.right = $(this).offset().left + $(this).outerWidth();

    openTerm(ref, false, linkPos);

    return false;
  });
}
