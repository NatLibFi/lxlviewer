# -*- coding: UTF-8 -*-
from __future__ import absolute_import, unicode_literals, print_function
import os
import operator
import json
import random
import string
from urlparse import urljoin
from datetime import datetime, timedelta

from rdflib import ConjunctiveGraph

from flask import (Flask, Response, g, request, render_template, redirect,
        abort, session, url_for, send_file)
from flask_login import LoginManager, login_required, login_user, flash, current_user, logout_user
from flask.helpers import NotFound
from werkzeug.urls import url_quote
from requests_oauthlib import OAuth2Session, TokenUpdated

from lxltools.util import as_iterable
from lxltools.ld.keys import CONTEXT, ID, TYPE, REVERSE

from .thingview import Things, Uris, IDKBSE, LIBRIS
from .marcframeview import MarcFrameView, pretty_json
from .user import User
from . import conneg

JSONLD_MIMETYPE = 'application/ld+json'
RDF_MIMETYPES = {'text/turtle', JSONLD_MIMETYPE, 'application/rdf+xml', 'text/xml'}
MIMETYPE_FORMATS = ['text/html', 'application/xhtml+xml'] + list(RDF_MIMETYPES)

##
# Application and template settings

class MyFlask(Flask):
    jinja_options = dict(Flask.jinja_options,
            variable_start_string='${', variable_end_string='}',
            line_statement_prefix='%')

app = MyFlask(__name__, static_url_path='/assets', static_folder='static',
        instance_relative_config=True)

app.config.from_object('viewer.configdefaults')
app.config.from_envvar('DEFVIEW_SETTINGS', silent=True)
app.config.from_pyfile('config.cfg', silent=True)


import __builtin__
for name, obj in vars(__builtin__).items():
    if callable(obj):
        app.add_template_global(obj, name)

for func in [operator.itemgetter]:
    app.add_template_global(func, func.__name__)

@app.template_global()
def union(*args):
    return reduce(lambda a, b: a | b, args)

@app.template_global()
def format_number(n):
    return '{:,}'.format(n).replace(',', ' ')


##
# Setup basic views

@app.route('/favicon.ico')
def favicon():
    abort(404)


##
# Setup viewer state

CONTEXT_PATH = '/context.jsonld'

TYPE_TEMPLATES = {
    'DataCatalog': 'website.html',
    'PartialCollectionView': 'pagedcollection.html',
    'Article': 'article.html'
}

def make_find_url(**kws):
    if 'q' not in kws:
        kws = dict(q='*', **kws)
    return url_for('find', **kws)

def _get_served_uri(url, path):
    # TODO: why is Flask unquoting url and path values?
    url_base = url_quote(url)
    path = url_quote(path)
    mapped_base = uris.to_canonical_uri(url_base)
    return urljoin(mapped_base, path)


##
# Setup data-access

things = Things(app.config)
uris = Uris(app.config)


@app.context_processor
def core_context():
    return {
        'ID': ID,'TYPE': TYPE, 'REVERSE': REVERSE,
        'vocab': things.ldview.vocab,
        'ldview': things.ldview,
        'ui': things.ui_defs,
        'lang': things.ldview.vocab.lang,
        'page_limit': 50,
        'canonical_uri': lambda uri: uris.find_canonical_uri(request.url_root, uri),
        'view_url': lambda uri: uris.to_view_url(request.url_root, uri)
    }

@app.before_request
def handle_base():
    canonical_site_id = uris.to_canonical_uri(request.url_root)
    if canonical_site_id == request.url_root:
        canonical_site_id = LIBRIS
    g.site = things.get_site(canonical_site_id)

@app.teardown_request
def disconnect_db(exception):
    things.ldview.storage.disconnect()


@app.route(CONTEXT_PATH)
def jsonld_context():
    return Response(json.dumps(things.jsonld_context_data),
            mimetype='application/ld+json; charset=UTF-8')


##
# Setup data-driven views

RESOURCE_METHODS = ['GET', 'PUT', 'DELETE']


@app.route('/<path:path>/data', methods=RESOURCE_METHODS)
@app.route('/<path:path>/data.<suffix>', methods=RESOURCE_METHODS)
@app.route('/<path:path>', methods=RESOURCE_METHODS)
def thingview(path, suffix=None):
    try:
        return app.send_static_file(path)
    except (NotFound, UnicodeEncodeError) as e:
        pass

    item_id = _get_served_uri(request.url_root, path)
    thing = things.ldview.get_record_data(item_id)

    mod_response = _handle_modification(request, thing)
    if mod_response:
        return mod_response

    if thing:
        #canonical = thing[ID]
        #if canonocal != item_id:
        #    return redirect(_to_data_path(see_path, suffix), 302)
        return rendered_response(path, suffix, thing)
    else:
        record_ids = things.ldview.find_record_ids(item_id)
        if record_ids: #and len(record_ids) == 1:
            return redirect(_to_data_path(record_ids[0], suffix), 303)
        #else:
        return abort(404)

def _to_data_path(path, suffix):
    return '%s/data.%s' % (path, suffix) if suffix else path

@app.route('/<path:path>/edit')
def thingedit(path):
    item_id = _get_served_uri(request.url_root, path)
    thing = things.ldview.get_record_data(item_id)
    if not thing:
        return abort(404)
    model = {}
    return render_template('edit.html',
            data=json.dumps(thing, ensure_ascii=False),
            model=json.dumps(model, ensure_ascii=False))

@app.route('/create', methods=['POST'])
def create():
    return _write_data(request)

def _handle_modification(request, item):
    # TODO: mock handling for now; should forward to backend API
    if item is None:
        return abort(404)
    if request.method == 'PUT':
        return _write_data(request, item)
    elif request.method == 'DELETE':
        return Response(status=204)

def _write_data(request, item=None):
    if JSONLD_MIMETYPE in request.headers.get('Content-Type'):
        if request.get_json(force=True) is None:
            return Response(status=400)
        else:
            return Response(status=204)
    else:
        return Response(status=415)


@app.route('/find')
@app.route('/find.<suffix>')
def find(suffix=None):
    results = things.ldview.get_search_results(request.args, make_find_url,
            uris.to_canonical_uri(request.url_root))
    return rendered_response('/find', suffix, results)

@app.route('/some')
@app.route('/some.<suffix>')
def some(suffix=None):
    ambiguity = things.ldview.find_ambiguity(request)
    if not ambiguity:
        return abort(404)
    return rendered_response('/some', suffix, ambiguity)

@app.route('/')
@app.route('/data')
@app.route('/data.<suffix>')
def dataindexview(suffix=None):
    slicerepr = request.args.get('slice')
    slicetree = json.loads(slicerepr) if slicerepr else g.site['slices']
    results = things.ldview.get_index_stats(slicetree, make_find_url,
            uris.to_canonical_uri(request.url_root))
    results.update(g.site)
    return rendered_response('/', suffix, results)

def rendered_response(path, suffix, thing):
    mimetype, render = negotiator.negotiate(request, suffix)
    if not render:
        return abort(406)
    result = render(path, thing)
    charset = 'charset=UTF-8' # technically redundant, but for e.g. JSONView
    resp = Response(result, mimetype=mimetype +'; '+ charset) if isinstance(
            result, bytes) else result
    if mimetype == 'application/json':
        context_link = '<%s>; rel="http://www.w3.org/ns/json-ld#context"' % CONTEXT_PATH
        resp.headers['Link'] = context_link
    if isinstance(resp, Response):
        resp.headers['Access-Control-Allow-Origin'] = "*"
        resp.headers['Access-Control-Allow-Methods'] = "GET"
    return resp


negotiator = conneg.Negotiator()

@negotiator.add('text/html', 'html')
@negotiator.add('application/xhtml+xml', 'xhtml')
def render_html(path, data):
    data = things.ldview.get_decorated_data(data, True)

    def data_url(suffix):
        if path == '/find':
            return url_for('find', suffix=suffix, **request.args)
        elif path == '/some':
            return url_for('some', suffix=suffix, **request.args)
        else:
            return url_for('thingview', path=path, suffix=suffix)

    return render_template(_get_template_for(data),
            path=path, thing=data, data_url=data_url)

@negotiator.add('application/json', 'json')
@negotiator.add('text/json')
def render_json(path, data):
    data = things.ldview.get_decorated_data(data, True)
    return _to_json(data)

@negotiator.add('application/ld+json', 'jsonld')
def render_jsonld(path, data):
    data[CONTEXT] = CONTEXT_PATH
    return _to_json(data)

@negotiator.add('text/turtle', 'ttl')
@negotiator.add('text/n3', 'n3') # older: text/rdf+n3, application/n3
def render_ttl(path, data):
    return _to_graph(data).serialize(format='turtle')

@negotiator.add('text/trig', 'trig')
def render_trig(path, data):
    return _to_graph(data).serialize(format='trig')

@negotiator.add('application/rdf+xml', 'rdf')
@negotiator.add('text/xml', 'xml')
def render_xml(path, data):
    return _to_graph(data).serialize(format='pretty-xml')

def _to_json(data):
    return json.dumps(data, indent=2, sort_keys=True,
            separators=(',', ': '), ensure_ascii=False).encode('utf-8')

def _to_graph(data, base=None):
    cg = ConjunctiveGraph()
    cg.parse(data=json.dumps(data), base=base or IDKBSE,
                format='json-ld', context=things.jsonld_context_data)
    return cg

def _get_template_for(data):
    for rtype in as_iterable(data.get(TYPE)):
        template = TYPE_TEMPLATES.get(rtype)
        if template:
            return template
    return 'thing.html'


##
# Setup vocab views

from rdflib import URIRef, RDF, RDFS, OWL, Namespace
from rdflib.namespace import SKOS, DCTERMS

rdfns = {
    'RDF': RDF,
    'RDFS': RDFS,
    'OWL': OWL,
    'SKOS': SKOS,
    'DCTERMS': DCTERMS,
    'VANN': Namespace("http://purl.org/vocab/vann/"),
    'VS': Namespace("http://www.w3.org/2003/06/sw-vocab-status/ns#"),
    'SCHEMA': Namespace("http://schema.org/"),
}

app.context_processor(lambda: rdfns)


@app.route('/vocab/')
def vocabview():
    voc = things.get_vocab_util()

    def link(obj):
        if ':' in obj.qname() and not any(obj.objects(None)):
            return obj.identifier
        return '#' + obj.qname()

    def listclass(o):
        return 'ext' if ':' in o.qname() else 'loc'

    mimetype = request.accept_mimetypes.best_match(MIMETYPE_FORMATS)
    if mimetype in RDF_MIMETYPES:
        return voc.graph.serialize(format=
                'json-ld' if mimetype == JSONLD_MIMETYPE else mimetype,
                #context_id=CONTEXT_PATH,
                context=things.jsonld_context_data[CONTEXT])

    return render_template('vocab.html',
            URIRef=URIRef, **vars())

#@app.route('/vocab/<term>')
#def vocab_term(term):
#    return redirect('/vocab/#' + term, 303)


##
# Setup marcframe view

mfview = MarcFrameView(
        app.config['MARCFRAME_SOURCE'], app.config['CACHE_DIR'])

@app.route('/marcframe/')
def marcframeview():
    return render_template('marcframeview.html',
            mf=mfview,
            pretty_json=pretty_json)

##
# Login start
# ----------------------------
#

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = app.config.get('OAUTHLIB_INSECURE_TRANSPORT') or '0'
app.secret_key = app.config.get('SESSION_SECRET_KEY') or ''.join(random.SystemRandom().choice(string.ascii_uppercase + string.digits) for _ in range(10))
app.remember_cookie_duration = timedelta(days=app.config.get('SESSION_COOKIE_LIFETIME') or 31)
app.permanent_session_lifetime = timedelta(days=app.config.get('SESSION_COOKIE_LIFETIME') or 31)

login_manager = LoginManager()
login_manager.setup_app(app)

def _render_login(msg = None):
    return render_template('login.html', msg = msg)

def _get_token():
    if 'oauth_token' in session:
        return session['oauth_token']
    return None

# Run on access token refreshed
def _token_updater(token):
    app.logger.info('Token expired updated to be %s ', json.dumps(token))
    session['oauth_token'] = token

def _get_requests_oauth():
    # Create new oAuth 2 session
    requests_oauth = OAuth2Session(app.config['OAUTH_CLIENT_ID'],
               redirect_uri=app.config['OAUTH_REDIRECT_URI'],
               auto_refresh_kwargs={ 'client_id': app.config['OAUTH_CLIENT_ID'], 'client_secret': app.config['OAUTH_CLIENT_SECRET'] },
               auto_refresh_url=app.config['OAUTH_TOKEN_URL'],
               token = _get_token(),
               token_updater=_token_updater
               )
    return requests_oauth


def _fake_login():
    fake_user_login = app.config.get('FAKE_LOGIN')
    if app.config.get('FAKE_LOGIN'):
        user = User(fake_user_login.get('name'), authorization=fake_user_login.get('authorization'))
        app.logger.debug("Faking login %s %s", user.get_id(), json.dumps(user.get_authorization()))
        login_user(user, True)
        session['authorization'] = user.authorization
        return True
    else:
        return False

@login_manager.user_loader
def _load_user(uid):
    if not 'authorization' in session:
        return None
    return User(uid, authorization=session.get('authorization'))

@login_manager.unauthorized_handler
def _handle_unauthorized():
    if _fake_login():
        return redirect('/')
    else:
        return redirect('/login')

# Login page
@app.route("/login")
def login():
    return _render_login()

# Route to redirect to oauth endpiont
@app.route('/login/authorize')
def login_authorize():
    try:
        requests_oauth = _get_requests_oauth()
        authorization_url, state =  requests_oauth.authorization_url(app.config['OAUTH_AUTHORIZATION_URL'], approval_prompt='auto')
        app.logger.info('[%s] Trying to authorize user, redirecting to %s ', request.remote_addr, authorization_url)
        # Redirect to oauth authorization
        return redirect(authorization_url)
    except Exception, e:
        app.logger.error('Failed to create authorization url,  %s ', str(e))
        return _render_login(str(e))

# Route called on oauth callback
@app.route('/login/authorized')
def authorized():
    app.logger.debug('Got authorized redirect')
    try:
        # Get access token
        try:
            token_url = app.config['OAUTH_TOKEN_URL']
            app.logger.info('[%s] Trying to get access token from %s', request.remote_addr, token_url)
            requests_oauth = _get_requests_oauth()
            # On authorized fetch token
            session['oauth_token'] = requests_oauth.fetch_token(token_url, client_secret=app.config['OAUTH_CLIENT_SECRET'], authorization_response=request.url)
            app.logger.debug('OAuth token received %s ', json.dumps(session['oauth_token']))
        except Exception, e:
            raise Exception('Failed to get token, %s response: %s ' % (token_url, str(e)))

        # Get user from verify
        try:
            varify_url = app.config['OAUTH_VERIFY_URL']
            verify_response = requests_oauth.get(varify_url).json()
            verify_user = verify_response['user']
            authorization = verify_user['authorization']
            username = verify_user['username']
            app.logger.info('[%s] User received from verify %s, %s', request.remote_addr, username, json.dumps(verify_user))

            # Create Flask User and login
            if(app.config.get('ALWAYS_ALLOW_XLREG') == 'True'):
                for auth in authorization:
                    auth['xlreg'] = True;
            user = User(username, authorization=authorization, token=session['oauth_token'])
            session['authorization'] = authorization
            login_user(user, True)

            return redirect('/')

        except Exception, e:
            raise Exception('Failed to verify user. %s response: %s ' % (varify_url, str(e)))

    except Exception, e:
        msg = str(e)
        app.logger.error(msg)
        return _render_login(msg)

# Logout user and session
# !TODO inform user or signout user in oauth endpoint
@app.route('/logout')
def logout():
    app.logger.info('[%s] Trying to sign out.', request.remote_addr)
    logout_user()
    session.pop('authorization', None)
    session.pop('oauth_token', None)
    return redirect('/')

# Login end
# ----------------------------
