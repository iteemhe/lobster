import backend
from flask import Flask,url_for, render_template,redirect, request
import flask
import time
import requests
import os,binascii

def verify_login(func):
    def wrapper():
        if 'Authorization' not in request.headers:
            return flask.abort(403)
        if request.headers['Authorization'].split(" ")[0] != "Token":
            return flask.abort(403)
        token = request.headers['Authorization'].split(" ")[1]
        cur = backend.conn.cursor()
        cur.execute("SELECT email from users where token = '%s'",(token,))
        response = cur.fetchone()
        if response == None:
            return flask.abort(403)
        cur.close()
        return func(response[0])
    wrapper.__name__ = func.__name__
    return wrapper

@backend.app.route('/logout/')
def logout():
    flask.session.clear()
    return "You have been logged out"

@backend.app.route('/login/')
def login():
    redirect_uri = url_for('authorize', _external=True)
    return backend.oauth.google.authorize_redirect(redirect_uri)

@backend.app.route('/authorize/')
def authorize():
    token = backend.oauth.google.authorize_access_token()
    url = backend.app.config["USER_INFO_URL"] + token["access_token"]
    response = requests.get(url)
    body = response.json()
    email = body['email']

    cur = backend.conn.cursor()
    cur.execute("SELECT token from users where email = %s",(email,))
    response = cur.fetchone()

    if response == None:
        token = binascii.b2a_hex(os.urandom(20)).decode('ascii')
        cur.execute("INSERT INTO users (email,fullname,token) VALUES (%s,%s, %s)",(email,body['name'],token))
        backend.conn.commit()
    else:
        token = response[0]
    cur.close()

    return {"token":token}

@backend.app.route('/api/ping/')
def ping():
    return "pong"
