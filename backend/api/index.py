import backend
from flask import Flask,url_for, render_template,redirect
import flask
import time

@backend.app.route('/logout/')
def logout():
    flask.session.clear()
    return redirect('/')

@backend.app.route('/login/')
def login():
    redirect_uri = url_for('authorize', _external=True)
    return backend.oauth.google.authorize_redirect(redirect_uri)

@backend.app.route('/authorize/')
def authorize():
    token = backend.oauth.google.authorize_access_token()
    resp = backend.oauth.google.get('https://www.googleapis.com/oauth2/v2/userinfo')
    profile = resp.json()
    flask.session['credentials'] = token
    flask.session['name'] = profile['name']
    return redirect('/')

@backend.app.route('/')
def index():
    if 'credentials' not in flask.session:
        return redirect('/login/')
    else:
        if time.time() > flask.session['credentials']['expires_at']:
            return redirect('/login/')
    # profile = resp.json()
    print(flask.session['credentials'])
    return flask.session['name']


@backend.app.route('/api/ping')
def ping():
    if 'credentials' not in flask.session:
        return redirect('/login/')
    else:
        if time.time() > flask.session['credentials']['expires_at']:
            return redirect('/login/')
    return "pong"
